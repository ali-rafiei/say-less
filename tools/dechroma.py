# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""Turn magenta-background PNGs (single images or sheets) into transparent, trimmed, square sprites.

Usage (from the repo root):
    uv run tools/dechroma.py                # processes art/raw/** into client/public/sprites and client/public/ui
    uv run tools/dechroma.py --size 768     # different output size
    uv run tools/dechroma.py --dry-run      # report only (sheets are still cut in memory to check the cells)
    uv run tools/dechroma.py --self-test    # cut synthetic sheets and check the cells

Input layout (see ASSETS.md):
    art/raw/characters/<characterId>.png           sheet, 3x2: idle writing waiting / win lose
                                                   -> client/public/sprites/<characterId>/<state>.webp
    art/raw/characters/<characterId>/<state>.png   single pose; replaces that sheet cell at the cell's scale
    art/raw/sheets/<sheet>.png                     UI sheet, cells as in SHEETS -> client/public/ui/<name>.webp
    art/raw/ui/<name>.png                          single UI image; wins over a sheet cell of the same name
    art/raw/backgrounds/<nn>-<palette>-*.png       full-bleed phase background, no keying
                                                   -> client/public/backgrounds/<palette>.webp

Sheets are cut by projection: key out the magenta, find bands of rows holding any
opaque pixel, then runs of columns inside each band. Runs closer than 4% of the sheet
size are merged so a detached sweat drop or falling mic stays with its character. If
the cells found do not match the expected grid, the sheet is split evenly instead and a
warning is printed.

The painted win pose holds a microphone the game does not show; remove_mic erases it from
every win sprite after scaling, so the character keeps its size and baseline.

Also rewrites client/public/sprites/manifest.json so the game knows which
character/state pairs have a raster sprite and should skip the SVG placeholder.
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import random
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RAW_CHARACTERS = ROOT / "art" / "raw" / "characters"
RAW_SHEETS = ROOT / "art" / "raw" / "sheets"
RAW_UI = ROOT / "art" / "raw" / "ui"
OUT_SPRITES = ROOT / "client" / "public" / "sprites"
OUT_UI = ROOT / "client" / "public" / "ui"
RAW_BACKGROUNDS = ROOT / "art" / "raw" / "backgrounds"
OUT_BACKGROUNDS = ROOT / "client" / "public" / "backgrounds"
PALETTES = ["home", "lobby", "writing", "voting", "results", "podium"]
CHARACTER_IDS = [
    "cat",
    "monkey",
    "duck",
    "bird",
    "axolotl",
    "bear",
    "rabbit",
    "fish",
    "blob",
    "otter",
    "penguin",
    "hedgehog",
]
STATES = ["idle", "writing", "waiting", "win", "lose"]

KEY = (255, 0, 255)
# WebP with alpha is about a fifth of the PNG size at no visible cost, which matters on a
# phone's data plan: the lobby alone shows twelve characters. iOS Safari 14+ and every
# Android Chrome decode it.
OUTPUT_SUFFIX = ".webp"
WEBP_QUALITY = 88
OPAQUE_ALPHA = 128
MERGE_GAP_RATIO = 0.04
MIC_POSE = "win"
MIC_MAX_CHROMA = 24
MIC_MIN_PIXELS = 500
MIC_MIN_OUTLINE_PIXELS = 50
MIC_EDGE_PX = 4
MIC_EDGE_MAX_VALUE = 150
NEIGHBOURS = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))
SELF_TEST_COLOURS = [
    (30, 120, 200),
    (40, 170, 80),
    (230, 200, 40),
    (20, 20, 40),
    (120, 200, 210),
    (250, 150, 60),
    (90, 60, 40),
    (160, 220, 120),
]
SELF_TEST_DROP = (140, 210, 255)


@dataclass(frozen=True)
class SheetLayout:
    columns: int
    rows: int
    cells: tuple[str | None, ...]
    shared_scale: bool = False

    @property
    def names(self) -> list[str]:
        return [name for name in self.cells if name is not None]

    @property
    def names_per_row(self) -> list[list[str]]:
        """Named cells grouped by grid row; rows with no named cell are left out."""
        rows = [self.cells[r * self.columns : (r + 1) * self.columns] for r in range(self.rows)]
        named = [[name for name in row if name is not None] for row in rows]
        return [row for row in named if row]


CHARACTER_SHEET = SheetLayout(3, 2, (*STATES, None), shared_scale=True)
SHEETS = {
    "stamps": SheetLayout(3, 2, ("micdrop", "silenced", "greatminds", "backfire", "robbed", None)),
    "icons": SheetLayout(4, 2, ("flame", "crown", "sound-on", "sound-off", "mic", "pencil", "tile", "seat")),
    "podium": SheetLayout(3, 1, ("stand-1", "stand-2", "stand-3"), shared_scale=True),
    "howto": SheetLayout(
        3,
        2,
        ("howto-gather", "howto-answer", "howto-vote", "howto-micdrop", "howto-roast", "howto-final"),
    ),
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--size", type=int, default=512, help="output side length in px (default 512)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true", help="cut synthetic sheets and check the result")
    args = parser.parse_args()
    if args.self_test:
        return self_test()

    manifest: dict[str, list[str]] = {}
    processed = convert_characters(args.size, args.dry_run, manifest)
    processed += convert_ui(args.size, args.dry_run)
    processed += convert_backgrounds(args.dry_run)

    if not args.dry_run:
        OUT_SPRITES.mkdir(parents=True, exist_ok=True)
        (OUT_SPRITES / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
        print(f"wrote {OUT_SPRITES.relative_to(ROOT)}/manifest.json")
        if OUT_UI.exists():
            bounds = {}
            for path in sorted(OUT_UI.glob(f"*{OUTPUT_SUFFIX}")):
                with Image.open(path) as image:
                    alpha = image.convert("RGBA").getchannel("A")
                    box = alpha.point(lambda a: 255 if a >= OPAQUE_ALPHA else 0).getbbox()
                    if box:
                        left, top, right, bottom = box
                        bounds[path.stem] = dict(x=left, y=top, width=right-left, height=bottom-top, size=image.width)
            (OUT_UI / "manifest.json").write_text(json.dumps(bounds, indent=2, sort_keys=True) + "\n")
    print(f"{processed} file(s) processed")
    if processed == 0:
        print("Nothing found under art/raw/. See ASSETS.md for the expected layout.", file=sys.stderr)
        return 1
    return 0


def convert_characters(size: int, dry_run: bool, manifest: dict[str, list[str]]) -> int:
    if not RAW_CHARACTERS.exists():
        return 0
    processed = 0
    for character_id in _raw_character_ids():
        if character_id not in CHARACTER_IDS:
            print(f"skip unknown character {character_id}", file=sys.stderr)
            continue
        out_dir = OUT_SPRITES / character_id
        singles = _single_poses(RAW_CHARACTERS / character_id)
        sheet = RAW_CHARACTERS / f"{character_id}.png"
        frames = {}
        if singles and sheet.exists():
            with Image.open(sheet) as raw:
                frames = cut_sheet(raw, CHARACTER_SHEET, size, str(sheet.relative_to(ROOT)))
        for state, source in singles.items():
            _convert_single(
                source,
                out_dir / f"{state}{OUTPUT_SUFFIX}",
                size,
                dry_run,
                frame=frames.get(state),
                strip_mic=state == MIC_POSE,
            )
        written = set(singles)
        if sheet.exists():
            written |= _convert_sheet(
                sheet, CHARACTER_SHEET, out_dir, size, dry_run, skip=set(singles), strip_mic=True
            )
        processed += len(written)
        if written:
            manifest[character_id] = [state for state in STATES if state in written]
    return processed


def convert_ui(size: int, dry_run: bool) -> int:
    singles = sorted(RAW_UI.glob("*.png")) if RAW_UI.exists() else []
    processed = 0
    if RAW_SHEETS.exists():
        for sheet in sorted(RAW_SHEETS.glob("*.png")):
            layout = SHEETS.get(sheet.stem)
            if layout is None:
                print(f"skip unknown sheet {sheet.name} (known: {', '.join(SHEETS)})", file=sys.stderr)
                continue
            processed += len(_convert_sheet(sheet, layout, OUT_UI, size, dry_run, skip={s.stem for s in singles}))
    for single in singles:
        _convert_single(single, OUT_UI / f"{single.stem}{OUTPUT_SUFFIX}", size, dry_run)
        processed += 1
    return processed


def convert_backgrounds(dry_run: bool) -> int:
    if not RAW_BACKGROUNDS.exists():
        return 0
    processed = 0
    for source in sorted(RAW_BACKGROUNDS.glob("*.png")):
        palette = next((name for name in PALETTES if name in source.stem.split("-")), None)
        if palette is None:
            print(f"skip {source.name}: its name holds none of {', '.join(PALETTES)}", file=sys.stderr)
            continue
        target = OUT_BACKGROUNDS / f"{palette}{OUTPUT_SUFFIX}"
        print(f"{source.relative_to(ROOT)} -> {target.relative_to(ROOT)}")
        processed += 1
        if dry_run:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as raw:
            raw.convert("RGB").save(target, "WEBP", quality=WEBP_QUALITY, method=6)
    return processed


def self_test() -> int:
    size = 96
    rng = random.Random(7)
    for label, layout in {"characters": CHARACTER_SHEET, **SHEETS}.items():
        sheet, colours, boxes = _synthetic_sheet(layout, rng)
        if layout is CHARACTER_SHEET:
            _draw_detached_drop(sheet, boxes, beside="writing", row=["idle", "writing", "waiting"])
        warnings = io.StringIO()
        with contextlib.redirect_stderr(warnings):
            sprites = cut_sheet(sheet, layout, size, f"synthetic {label}")
        assert not warnings.getvalue(), f"{label}: unexpected warning {warnings.getvalue()!r}"
        _check_cells(label, layout, sprites, colours, size, same_baseline=label in ("characters", "podium"))
        if layout is CHARACTER_SHEET:
            holders = [name for name, sprite in sprites.items() if _has_colour(sprite, SELF_TEST_DROP)]
            assert holders == ["writing"], f"{label}: detached drop landed in {holders}, expected ['writing']"
        if label == "podium":
            widths, heights = zip(*(_opaque_size(sprites[name]) for name in layout.names))
            assert max(widths) - min(widths) <= 1, f"podium: stand widths {widths} differ"
            assert list(heights) == sorted(heights, reverse=True), f"podium: stand heights {heights} lost their order"
        print(f"ok {label}: {' '.join(sprites)}")

    sheet, colours, boxes = _synthetic_sheet(CHARACTER_SHEET, rng)
    _draw_bridge(sheet, boxes["idle"], boxes["writing"], colours["idle"])
    warnings = io.StringIO()
    with contextlib.redirect_stderr(warnings):
        sprites = cut_sheet(sheet, CHARACTER_SHEET, size, "synthetic bridged characters")
    assert "even 3x2 grid" in warnings.getvalue(), f"bridged sheet did not fall back: {warnings.getvalue()!r}"
    _check_cells("bridged characters", CHARACTER_SHEET, sprites, colours, size, same_baseline=True)
    print(f"ok bridged characters (even-grid fallback): {' '.join(sprites)}")
    narrow = Image.new("RGB", (600, 400), KEY)
    draw = ImageDraw.Draw(narrow)
    colours = dict(zip(STATES, SELF_TEST_COLOURS))
    boxes = [(30, 30, 210, 175), (225, 30, 385, 175), (430, 30, 575, 175),
             (30, 230, 210, 375), (225, 230, 385, 375)]
    for name, box in zip(STATES, boxes):
        draw.rectangle(box, fill=colours[name])
    keyed = key_out_magenta(narrow)
    cells = _find_cells(keyed, CHARACTER_SHEET, "narrow gaps")
    assert cells["idle"][2] == 211, "narrow-gap cut clipped art at the even-grid boundary"
    for name, box in cells.items():
        crop = keyed.crop(box)
        opaque_colours = {rgba[:3] for _, rgba in crop.getcolors(crop.width * crop.height) if rgba[3]}
        assert opaque_colours == {colours[name]}, f"narrow-gap {name}: neighbouring art leaked in"
    for colour in ((232, 128, 122, 255), (160, 130, 150, 255), (125, 125, 125, 255), (255, 61, 104, 255)):
        assert key_out_magenta(Image.new("RGBA", (1, 1), colour)).getpixel((0, 0)) == colour
    dark_edge = key_out_magenta(Image.new("RGBA", (1, 1), (80, 24, 100, 255))).getpixel((0, 0))
    assert dark_edge == (24, 24, 44, 255), f"dark edge still has a magenta cast: {dark_edge}"
    assert key_out_magenta(Image.new("RGB", (1, 1), KEY)).getpixel((0, 0))[3] == 0
    print("ok narrow-gap crops and opaque coral colours")
    body = (200, 120, 80, 255)
    frame = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rectangle((156, 60, 355, 479), fill=body)
    revision = Image.new("RGBA", (1000, 1000), (0, 0, 0, 0))
    ImageDraw.Draw(revision).rectangle((300, 100, 699, 939), fill=body)
    for corner in ((4, 4), (995, 4), (4, 995), (995, 995)):
        revision.putpixel(corner, (255, 0, 255, 60))
    fitted_box = _opaque_bbox(fit_replacement(revision, frame))
    frame_box = _opaque_bbox(frame)
    assert fitted_box[3] == frame_box[3], f"revision lost the baseline: {fitted_box} vs {frame_box}"
    assert fitted_box[3] - fitted_box[1] >= (frame_box[3] - frame_box[1]) - 2, (
        f"faint specks shrank the revision: {fitted_box} vs {frame_box}"
    )
    print("ok revised pose keeps its sheet scale despite faint specks")
    mic_grey = (70, 72, 70, 255)
    for label, mic_box in (("detached", (140, 40, 180, 90)), ("touching", (118, 40, 158, 90))):
        pose = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
        draw = ImageDraw.Draw(pose)
        draw.rectangle((40, 30, 120, 190), fill=body)
        draw.rectangle(mic_box, fill=mic_grey)
        cleaned = remove_mic(pose)
        assert not _has_colour(cleaned, mic_grey[:3]), f"{label} mic survived"
        assert _opaque_bbox(cleaned) == (40, 30, 121, 191), f"{label} mic removal hurt the body"
    face = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    draw = ImageDraw.Draw(face)
    draw.rectangle((40, 30, 120, 190), fill=body)
    draw.rectangle((60, 60, 95, 95), fill=mic_grey)
    assert _has_colour(remove_mic(face), mic_grey[:3]), "a dark face feature inside the body was erased"
    print("ok win-pose mic removed, detached or touching; face features kept")
    print("self-test passed")
    return 0


def cut_sheet(sheet: Image.Image, layout: SheetLayout, size: int, label: str) -> dict[str, Image.Image]:
    """Key a sheet and return one square sprite per named cell; empty cells are left out with a warning."""
    keyed = key_out_magenta(sheet)
    crops = {}
    for name, box in _find_cells(keyed, layout, label).items():
        crop = keyed.crop(box)
        if crop.getbbox() is None:
            print(f"warning: {label}: cell {name} is empty, skipped", file=sys.stderr)
            continue
        crops[name] = crop
    if layout.shared_scale:
        return _square_together(crops, size)
    return {name: trim_and_square(crop, size) for name, crop in crops.items()}


def key_out_magenta(image: Image.Image, soft_lo: int = 40, soft_hi: int = 170) -> Image.Image:
    """Alpha from distance to pure magenta; despill the pink fringe on soft edges."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Only key colours with a magenta cast. Distance alone also catches
            # opaque coral, dusty lavender and medium grey inside the artwork.
            excess = min(r, b) - g
            if excess <= 30 or b < r * 0.75:
                continue
            distance = max(abs(r - KEY[0]), abs(g - KEY[1]), abs(b - KEY[2]))
            if distance <= soft_lo:
                pixels[x, y] = (0, 0, 0, 0)
            elif distance < soft_hi:
                alpha = int(255 * (distance - soft_lo) / (soft_hi - soft_lo))
                # Despill: pull R/B toward G so the edge does not glow pink.
                r2 = max(0, r - excess)
                b2 = max(0, b - excess)
                pixels[x, y] = (r2, g, b2, min(a, alpha))
            else:
                # Dark antialiased ink edges may be far from the bright key
                # while retaining a visible magenta fringe.
                pixels[x, y] = (max(0, r - excess), g, max(0, b - excess), a)
    return rgba


def trim_and_square(image: Image.Image, size: int, padding_ratio: float = 0.06) -> Image.Image:
    bbox = image.getbbox()
    if bbox is None:
        raise ValueError("image is fully transparent after keying")
    cropped = image.crop(bbox)
    side = int(max(cropped.size) * (1 + 2 * padding_ratio))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cropped.width) // 2, (side - cropped.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def _raw_character_ids() -> list[str]:
    entries = (p for p in RAW_CHARACTERS.iterdir() if p.is_dir() or p.suffix == ".png")
    return sorted({p.name if p.is_dir() else p.stem for p in entries})


def _single_poses(folder: Path) -> dict[str, Path]:
    if not folder.is_dir():
        return {}
    poses = {}
    for state_file in sorted(folder.glob("*.png")):
        if state_file.stem not in STATES:
            print(f"skip unknown state {state_file}", file=sys.stderr)
            continue
        poses[state_file.stem] = state_file
    return poses


def _convert_single(
    source: Path,
    target: Path,
    size: int,
    dry_run: bool,
    frame: Image.Image | None = None,
    strip_mic: bool = False,
) -> None:
    print(f"{source.relative_to(ROOT)} -> {target.relative_to(ROOT)}")
    if dry_run:
        return
    with Image.open(source) as raw:
        keyed = key_out_magenta(raw)
    sprite = fit_replacement(keyed, frame) if frame is not None else trim_and_square(keyed, size)
    if strip_mic:
        sprite = remove_mic(sprite)
    target.parent.mkdir(parents=True, exist_ok=True)
    _save(sprite, target)


def fit_replacement(image: Image.Image, frame: Image.Image) -> Image.Image:
    """Keep a revised pose inside its original sheet pose's scale and baseline.

    Both poses are measured by their opaque pixels. An edited image often keeps a
    faint, half-keyed haze of uneven background far from the character, and measuring
    that would shrink the character to fit it.
    """
    bounds = _opaque_bbox(frame)
    subject = _opaque_bbox(image)
    if bounds is None or subject is None:
        raise ValueError("replacement or reference pose is empty")
    left, top, right, bottom = bounds
    cropped = image.crop(subject)
    scale = min((right - left) / cropped.width, (bottom - top) / cropped.height)
    resized = cropped.resize((max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))), Image.LANCZOS)
    result = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    result.paste(resized, ((left + right - resized.width) // 2, bottom - resized.height))
    return result


def remove_mic(sprite: Image.Image) -> Image.Image:
    """Erase the neutral-grey microphone from a win pose.

    A detached mic is erased whole, band and all. A mic touching the body is found by
    colour instead (the animals are never neutral grey), then its dark antialiased rim.
    """
    image = sprite.convert("RGBA")
    pixels = image.load()
    width = image.width

    def point(index: int) -> tuple[int, int]:
        return index % width, index // width

    def neutral(index: int) -> bool:
        r, g, b, a = pixels[point(index)]
        return a > 0 and max(r, g, b) - min(r, g, b) <= MIC_MAX_CHROMA

    blobs = _components(image, lambda index: pixels[point(index)][3] > 0)
    if not blobs:
        return image
    erase: list[int] = []
    for blob in blobs[1:]:
        opaque = [index for index in blob if pixels[point(index)][3] >= OPAQUE_ALPHA]
        if len(opaque) >= MIC_MIN_PIXELS and sum(map(neutral, opaque)) * 2 >= len(opaque):
            erase += blob
    if not erase:
        body = set(blobs[0])
        greys = _components(image, lambda index: index in body and neutral(index))
        # Dark eyes and mouths are grey too, but only a held mic reaches the silhouette.
        mics = [grey for grey in greys if len(grey) >= MIC_MIN_PIXELS and _borders_transparency(image, grey)]
        if mics:
            erase = _grow_dark_rim(image, mics[0])
    for index in erase:
        pixels[point(index)] = (0, 0, 0, 0)
    return image


def _components(image: Image.Image, include) -> list[list[int]]:
    """8-connected groups of pixel indices where include(index) holds, largest first."""
    width, height = image.size
    seen = bytearray(width * height)
    groups = []
    for start in range(width * height):
        if seen[start] or not include(start):
            continue
        seen[start] = 1
        queue, group = [start], []
        while queue:
            index = queue.pop()
            group.append(index)
            x, y = index % width, index // width
            for dx, dy in NEIGHBOURS:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    neighbour = ny * width + nx
                    if not seen[neighbour] and include(neighbour):
                        seen[neighbour] = 1
                        queue.append(neighbour)
        groups.append(group)
    return sorted(groups, key=len, reverse=True)


def _borders_transparency(image: Image.Image, group: list[int]) -> bool:
    width, height = image.size
    pixels = image.load()
    touching = 0
    for index in group:
        x, y = index % width, index // width
        if any(
            0 <= x + dx < width and 0 <= y + dy < height and pixels[x + dx, y + dy][3] == 0 for dx, dy in NEIGHBOURS
        ):
            touching += 1
            if touching >= MIC_MIN_OUTLINE_PIXELS:
                return True
    return False


def _grow_dark_rim(image: Image.Image, seed: list[int]) -> list[int]:
    width, height = image.size
    pixels = image.load()
    region = set(seed)
    frontier = list(seed)
    for _ in range(MIC_EDGE_PX):
        grown = []
        for index in frontier:
            x, y = index % width, index // width
            for dx, dy in NEIGHBOURS:
                nx, ny = x + dx, y + dy
                if not (0 <= nx < width and 0 <= ny < height):
                    continue
                neighbour = ny * width + nx
                r, g, b, a = pixels[nx, ny]
                if neighbour not in region and a > 0 and max(r, g, b) < MIC_EDGE_MAX_VALUE:
                    region.add(neighbour)
                    grown.append(neighbour)
        frontier = grown
    return list(region)


def _convert_sheet(
    source: Path,
    layout: SheetLayout,
    out_dir: Path,
    size: int,
    dry_run: bool,
    skip: set[str],
    strip_mic: bool = False,
) -> set[str]:
    with Image.open(source) as raw:
        sprites = cut_sheet(raw, layout, size, str(source.relative_to(ROOT)))
    written = set()
    for name, sprite in sprites.items():
        target = out_dir / f"{name}{OUTPUT_SUFFIX}"
        if name in skip:
            print(f"{source.relative_to(ROOT)} [{name}] skipped: a single file replaces this cell")
            continue
        print(f"{source.relative_to(ROOT)} [{name}] -> {target.relative_to(ROOT)}")
        written.add(name)
        if not dry_run:
            if strip_mic and name == MIC_POSE:
                sprite = remove_mic(sprite)
            target.parent.mkdir(parents=True, exist_ok=True)
            _save(sprite, target)
    return written


def _find_cells(keyed: Image.Image, layout: SheetLayout, label: str) -> dict[str, tuple[int, int, int, int]]:
    mask = keyed.getchannel("A").point(lambda a: 255 if a >= OPAQUE_ALPHA else 0)
    expected_per_row = [len(row) for row in layout.names_per_row]
    # Narrow inter-cell gaps can be smaller than the default prop-merging radius.
    # Retry conservatively, accepting a cut only when every row matches the layout.
    for ratio in (MERGE_GAP_RATIO, 0.03, 0.025, 0.02, 0.015, 0.01, 0.005):
        column_gap = int(keyed.width * ratio)
        found = []
        for top, bottom in _runs(_occupied_rows(mask), int(keyed.height * MERGE_GAP_RATIO)):
            band = mask.crop((0, top, mask.width, bottom)).transpose(Image.Transpose.TRANSPOSE)
            found.append([(left, top, right, bottom) for left, right in _runs(_occupied_rows(band), column_gap)])
        found_per_row = [len(row) for row in found]
        if found_per_row == expected_per_row:
            return dict(zip(layout.names, (box for row in found for box in row)))
    print(
        f"warning: {label}: found {sum(found_per_row)} cells (rows of {found_per_row}), "
        f"expected {sum(expected_per_row)} (rows of {expected_per_row}); "
        f"cutting an even {layout.columns}x{layout.rows} grid instead",
        file=sys.stderr,
    )
    return _even_grid(keyed.size, layout)


def _occupied_rows(mask: Image.Image) -> list[bool]:
    data = mask.tobytes()
    width = mask.width
    return [bool(data[y * width : (y + 1) * width].strip(b"\0")) for y in range(mask.height)]


def _runs(flags: list[bool], merge_gap: int) -> list[tuple[int, int]]:
    """Half-open [start, end) spans of consecutive True flags, joining spans separated by less than merge_gap."""
    runs: list[tuple[int, int]] = []
    start = None
    for index, flag in enumerate([*flags, False]):
        if flag and start is None:
            start = index
        elif not flag and start is not None:
            if runs and start - runs[-1][1] < merge_gap:
                runs[-1] = (runs[-1][0], index)
            else:
                runs.append((start, index))
            start = None
    return runs


def _even_grid(sheet_size: tuple[int, int], layout: SheetLayout) -> dict[str, tuple[int, int, int, int]]:
    width, height = sheet_size
    boxes = {}
    for index, name in enumerate(layout.cells):
        if name is None:
            continue
        column, row = index % layout.columns, index // layout.columns
        boxes[name] = (
            column * width // layout.columns,
            row * height // layout.rows,
            (column + 1) * width // layout.columns,
            (row + 1) * height // layout.rows,
        )
    return boxes


def _square_together(crops: dict[str, Image.Image], size: int, padding_ratio: float = 0.06) -> dict[str, Image.Image]:
    """Trim every crop, then scale them all by the same factor and stand them on one shared baseline."""
    trimmed = {name: crop.crop(crop.getbbox()) for name, crop in crops.items()}
    if not trimmed:
        return {}
    longest = max(max(image.size) for image in trimmed.values())
    side = int(longest * (1 + 2 * padding_ratio))
    baseline = side - (side - longest) // 2
    squared = {}
    for name, image in trimmed.items():
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(image, ((side - image.width) // 2, baseline - image.height))
        squared[name] = canvas.resize((size, size), Image.LANCZOS)
    return squared


def _synthetic_sheet(
    layout: SheetLayout, rng: random.Random
) -> tuple[Image.Image, dict[str, tuple[int, int, int]], dict[str, tuple[int, int, int, int]]]:
    """Magenta canvas with one coloured shape per named cell, drifted off the even grid."""
    cell = 160
    sheet = Image.new("RGB", (layout.columns * cell, layout.rows * cell), KEY)
    draw = ImageDraw.Draw(sheet)
    colours: dict[str, tuple[int, int, int]] = {}
    boxes: dict[str, tuple[int, int, int, int]] = {}
    podium_heights = {"stand-1": 110, "stand-2": 80, "stand-3": 55}
    for index, name in enumerate(layout.cells):
        if name is None:
            continue
        column, row = index % layout.columns, index // layout.columns
        centre_x = column * cell + cell // 2 + rng.randint(-10, 10)
        width = 80 if name in podium_heights else rng.randint(50, 90)
        height = podium_heights.get(name) or rng.randint(60, 100)
        if layout.shared_scale:
            bottom = row * cell + 145 + rng.randint(-3, 3)
        else:
            bottom = row * cell + cell // 2 + height // 2 + rng.randint(-10, 10)
        box = (centre_x - width // 2, bottom - height, centre_x + width // 2, bottom)
        colours[name] = SELF_TEST_COLOURS[len(colours)]
        boxes[name] = box
        if name in podium_heights:
            draw.rectangle(box, fill=colours[name])
        else:
            draw.ellipse(box, fill=colours[name])
    return sheet, colours, boxes


def _draw_detached_drop(
    sheet: Image.Image, boxes: dict[str, tuple[int, int, int, int]], beside: str, row: list[str]
) -> None:
    """A small shape above and to the right of one character, clear of it by less than the merge gap."""
    row_top = min(boxes[name][1] for name in row)
    right = boxes[beside][2]
    ImageDraw.Draw(sheet).ellipse((right + 6, row_top - 20, right + 20, row_top - 6), fill=SELF_TEST_DROP)


def _draw_bridge(
    sheet: Image.Image, left: tuple[int, int, int, int], right: tuple[int, int, int, int], colour: tuple[int, int, int]
) -> None:
    middle = (left[1] + left[3]) // 2
    ImageDraw.Draw(sheet).rectangle((left[2] - 4, middle - 4, right[0] + 4, middle + 4), fill=colour)


def _check_cells(
    label: str,
    layout: SheetLayout,
    sprites: dict[str, Image.Image],
    colours: dict[str, tuple[int, int, int]],
    size: int,
    same_baseline: bool,
) -> None:
    assert list(sprites) == layout.names, f"{label}: cut {list(sprites)}, expected {layout.names}"
    for name, sprite in sprites.items():
        assert sprite.size == (size, size), f"{label}/{name}: size {sprite.size}"
        assert sprite.getbbox() is not None, f"{label}/{name}: empty"
        dominant = _dominant_colour(sprite)
        assert dominant == colours[name], f"{label}/{name}: holds colour {dominant}, expected {colours[name]}"
    if same_baseline:
        bottoms = {name: sprite.getbbox()[3] for name, sprite in sprites.items()}
        assert max(bottoms.values()) - min(bottoms.values()) <= 1, f"{label}: baselines differ {bottoms}"


def _dominant_colour(sprite: Image.Image) -> tuple[int, int, int]:
    counts = sprite.getcolors(sprite.width * sprite.height) or []
    opaque = [(count, rgba[:3]) for count, rgba in counts if rgba[3] == 255]
    return max(opaque)[1]


def _has_colour(sprite: Image.Image, colour: tuple[int, int, int], tolerance: int = 16) -> bool:
    counts = sprite.getcolors(sprite.width * sprite.height) or []
    return any(rgba[3] == 255 and max(abs(rgba[i] - colour[i]) for i in range(3)) <= tolerance for _, rgba in counts)


def _save(sprite: Image.Image, target: Path) -> None:
    sprite.save(target, "WEBP", quality=WEBP_QUALITY, method=6)


def _opaque_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda a: 255 if a >= OPAQUE_ALPHA else 0).getbbox()


def _opaque_size(sprite: Image.Image) -> tuple[int, int]:
    left, top, right, bottom = sprite.getbbox()
    return right - left, bottom - top


if __name__ == "__main__":
    raise SystemExit(main())
