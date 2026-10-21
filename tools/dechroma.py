# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10", "numpy>=1.26", "scipy>=1.11"]
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

Sheets are cut by piece: key out the magenta, then give every separate piece of art (a
character, a detached sweat drop, a prop) to the grid cell its centre falls in, or to the
nearest named cell when it falls in an empty one. Each cell keeps only its own pieces, so
a wide pose whose box overlaps a neighbour's still comes out whole and clean. If a named
cell gets nothing (art touching across cells), the sheet is split evenly instead and a
warning is printed.

Also rewrites client/public/ui/manifest.json with each UI image's opaque bounds.
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

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

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
    "bigfoot",
    "yeti",
    "nessie",
    "mothman",
    "jackalope",
    "kraken",
    "kappa",
    "alien",
    "ghost",
    "chupacabra",
    "flatwoods",
    "werewolf",
    "vampire",
    "skeleton",
    "phoenix",
    "unicorn",
    "gargoyle",
    "cerberus",
]
STATES = ["idle", "writing", "waiting", "win", "lose"]

KEY = (255, 0, 255)
# WebP with alpha is about a fifth of the PNG size at no visible cost, which matters on a
# phone's data plan: the lobby alone shows eighteen characters. iOS Safari 14+ and every
# Android Chrome decode it.
OUTPUT_SUFFIX = ".webp"
WEBP_QUALITY = 88
OPAQUE_ALPHA = 128
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


CHARACTER_SHEET = SheetLayout(3, 2, (*STATES, None), shared_scale=True)
SHEETS = {
    "icons": SheetLayout(4, 2, ("flame", "crown", "sound-on", "sound-off", "pencil", "tile", "seat", None)),
    "podium": SheetLayout(3, 1, ("stand-1", "stand-2", "stand-3"), shared_scale=True),
    "howto": SheetLayout(
        3,
        2,
        ("howto-gather", "howto-answer", "howto-vote", "howto-rounds", "howto-roast", "howto-final"),
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

    processed = convert_characters(args.size, args.dry_run)
    processed += convert_ui(args.size, args.dry_run)
    processed += convert_backgrounds(args.dry_run)

    if not args.dry_run:
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


def convert_characters(size: int, dry_run: bool) -> int:
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
            _convert_single(source, out_dir / f"{state}{OUTPUT_SUFFIX}", size, dry_run, frame=frames.get(state))
        written = set(singles)
        if sheet.exists():
            written |= _convert_sheet(sheet, CHARACTER_SHEET, out_dir, size, dry_run, skip=set(singles))
        processed += len(written)
        missing = [state for state in STATES if state not in written]
        if missing:
            print(f"warning: {character_id} has no {', '.join(missing)} sprite", file=sys.stderr)
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
    sheet, colours, boxes = _synthetic_sheet(CHARACTER_SHEET, rng)
    left, top, right, _ = boxes["win"]
    row_above = max(boxes[name][3] for name in ("idle", "writing", "waiting"))
    middle = (left + right) // 2
    draw = ImageDraw.Draw(sheet)
    # Up to just under the row above, then across over the lose pose without touching it.
    draw.rectangle((middle - 4, row_above + 6, middle + 4, top), fill=colours["win"])
    draw.rectangle((middle - 4, row_above + 6, boxes["lose"][0] + 20, row_above + 12), fill=colours["win"])
    warnings = io.StringIO()
    with contextlib.redirect_stderr(warnings):
        sprites = cut_sheet(sheet, CHARACTER_SHEET, size, "synthetic reaching arm")
    assert not warnings.getvalue(), f"reaching arm: {warnings.getvalue()!r}"
    _check_cells("reaching arm", CHARACTER_SHEET, sprites, colours, size, same_baseline=True)
    assert not _has_colour(sprites["lose"], colours["win"]), "reaching arm: the win arm leaked into lose"
    print("ok an arm reaching under the row above and over its neighbour stays in its own cell")
    narrow = Image.new("RGB", (600, 400), KEY)
    draw = ImageDraw.Draw(narrow)
    colours = dict(zip(STATES, SELF_TEST_COLOURS))
    boxes = [(30, 30, 210, 175), (225, 30, 385, 175), (430, 30, 575, 175),
             (30, 230, 210, 375), (225, 230, 385, 375)]
    for name, box in zip(STATES, boxes):
        draw.rectangle(box, fill=colours[name])
    crops = _cell_crops(key_out_magenta(narrow), CHARACTER_SHEET, "narrow gaps")
    assert crops["idle"].width == 181, "narrow-gap cut clipped art at the even-grid boundary"
    for name, crop in crops.items():
        opaque_colours = {rgba[:3] for _, rgba in crop.getcolors(crop.width * crop.height) if rgba[3]}
        assert opaque_colours == {colours[name]}, f"narrow-gap {name}: neighbouring art leaked in"
    for colour in ((232, 128, 122, 255), (160, 130, 150, 255), (125, 125, 125, 255), (255, 61, 104, 255)):
        assert key_out_magenta(Image.new("RGBA", (1, 1), colour)).getpixel((0, 0)) == colour
    edge = Image.new("RGBA", (2, 1), (*KEY, 255))
    edge.putpixel((1, 0), (80, 24, 100, 255))
    dark_edge = key_out_magenta(edge).getpixel((1, 0))
    assert dark_edge == (24, 24, 44, 255), f"dark edge still has a magenta cast: {dark_edge}"
    assert key_out_magenta(Image.new("RGB", (1, 1), KEY)).getpixel((0, 0))[3] == 0
    pink = (220, 90, 210)
    ear = Image.new("RGB", (20, 20), KEY)
    ImageDraw.Draw(ear).rectangle((4, 4, 15, 15), fill=(26, 26, 46))
    ImageDraw.Draw(ear).rectangle((7, 7, 12, 12), fill=pink)
    keyed_ear = key_out_magenta(ear)
    assert keyed_ear.getpixel((10, 10)) == (*pink, 255), "a pink patch inside the outline was keyed"
    assert keyed_ear.getpixel((0, 0))[3] == 0, "the background around the outline was not keyed"
    print("ok narrow-gap crops, opaque coral colours, and pink walled in by the outline")
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
    print("self-test passed")
    return 0


def cut_sheet(sheet: Image.Image, layout: SheetLayout, size: int, label: str) -> dict[str, Image.Image]:
    """Key a sheet and return one square sprite per named cell; empty cells are left out with a warning."""
    crops = {}
    for name, crop in _cell_crops(key_out_magenta(sheet), layout, label).items():
        if crop.getbbox() is None:
            print(f"warning: {label}: cell {name} is empty, skipped", file=sys.stderr)
            continue
        crops[name] = crop
    if layout.shared_scale:
        return _square_together(crops, size)
    return {name: trim_and_square(crop, size) for name, crop in crops.items()}


def key_out_magenta(image: Image.Image, soft_lo: int = 40, soft_hi: int = 170) -> Image.Image:
    """Alpha from distance to pure magenta; despill the pink fringe on soft edges.

    Only colours with a magenta cast are keyed (distance alone also catches opaque coral,
    dusty lavender and medium grey), and only in a connected patch that holds true key
    colour somewhere. A pink inner ear or tongue walled in by the outline is art, not
    background, and keeps its colour.
    """
    rgba = np.array(image.convert("RGBA")).astype(np.int32)
    r, g, b, a = rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3]
    excess = np.minimum(r, b) - g
    cast = (excess > 30) & (b >= r * 0.75)
    distance = np.maximum.reduce([np.abs(r - KEY[0]), np.abs(g - KEY[1]), np.abs(b - KEY[2])])
    patches, count = ndimage.label(cast, structure=np.ones((3, 3)))
    background = np.zeros(count + 1, dtype=bool)
    background[np.unique(patches[cast & (distance <= soft_lo)])] = True
    background[0] = False
    keyed = background[patches]
    # Despill: pull R/B toward G so the edge does not glow pink. Dark antialiased ink
    # edges past soft_hi keep their alpha but lose the magenta fringe too.
    out = rgba.copy()
    out[..., 0] = np.where(keyed, np.maximum(0, r - excess), r)
    out[..., 2] = np.where(keyed, np.maximum(0, b - excess), b)
    soft = keyed & (distance < soft_hi)
    out[..., 3] = np.where(soft, np.minimum(a, 255 * (distance - soft_lo) // (soft_hi - soft_lo)), a)
    out[keyed & (distance <= soft_lo)] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")


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


def _convert_single(source: Path, target: Path, size: int, dry_run: bool, frame: Image.Image | None = None) -> None:
    print(f"{source.relative_to(ROOT)} -> {target.relative_to(ROOT)}")
    if dry_run:
        return
    with Image.open(source) as raw:
        keyed = key_out_magenta(raw)
    sprite = fit_replacement(keyed, frame) if frame is not None else trim_and_square(keyed, size)
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


def _convert_sheet(
    source: Path,
    layout: SheetLayout,
    out_dir: Path,
    size: int,
    dry_run: bool,
    skip: set[str],
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
            target.parent.mkdir(parents=True, exist_ok=True)
            _save(sprite, target)
    return written


def _cell_crops(keyed: Image.Image, layout: SheetLayout, label: str) -> dict[str, Image.Image]:
    rgba = np.array(keyed)
    alpha = rgba[..., 3]
    pieces, count = ndimage.label(alpha > 0, structure=np.ones((3, 3)))
    index = np.arange(1, count + 1)
    peaks = ndimage.maximum(alpha, pieces, index) if count else []
    centres = ndimage.center_of_mass(alpha > 0, pieces, index) if count else []
    cell_width, cell_height = keyed.width / layout.columns, keyed.height / layout.rows
    named = {cell: name for cell, name in enumerate(layout.cells) if name is not None}

    def distance_to(cell: int, x: float, y: float) -> float:
        column, row = cell % layout.columns, cell // layout.columns
        return ((column + 0.5) * cell_width - x) ** 2 + ((row + 0.5) * cell_height - y) ** 2

    # owner[piece] is the cell index + 1; 0 drops faint haze with no solid pixel.
    owner = np.zeros(count + 1, dtype=np.int32)
    for piece, (y, x), peak in zip(index, centres, peaks):
        if peak < OPAQUE_ALPHA:
            continue
        cell = min(int(y // cell_height), layout.rows - 1) * layout.columns + min(int(x // cell_width), layout.columns - 1)
        if cell not in named:
            cell = min(named, key=lambda candidate: distance_to(candidate, x, y))
        owner[piece] = cell + 1
    empty = [name for cell, name in named.items() if not (owner == cell + 1).any()]
    if empty:
        print(
            f"warning: {label}: no separate art for {', '.join(empty)}; "
            f"cutting an even {layout.columns}x{layout.rows} grid instead",
            file=sys.stderr,
        )
        return {name: keyed.crop(box) for name, box in _even_grid(keyed.size, layout).items()}
    pixel_owner = owner[pieces]
    crops = {}
    for cell, name in named.items():
        mine = pixel_owner == cell + 1
        rows, columns = np.nonzero(mine)
        box = (slice(rows.min(), rows.max() + 1), slice(columns.min(), columns.max() + 1))
        crops[name] = Image.fromarray(np.where(mine[box][..., None], rgba[box], 0).astype(np.uint8), "RGBA")
    return crops


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
