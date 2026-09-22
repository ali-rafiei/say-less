# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""Turn magenta-background PNGs into transparent, trimmed, square sprites.

Usage (from the repo root):
    uv run tools/dechroma.py                # processes art/raw/** into client/public/sprites and client/public/ui
    uv run tools/dechroma.py --size 768     # different output size
    uv run tools/dechroma.py --dry-run      # report only

Input layout (see ASSETS.md):
    art/raw/characters/<characterId>/<state>.png   -> client/public/sprites/<characterId>/<state>.png
    art/raw/ui/<name>.png                          -> client/public/ui/<name>.png

Also rewrites client/public/sprites/manifest.json so the game knows which
character/state pairs have a raster sprite and should skip the SVG placeholder.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_CHARACTERS = ROOT / "art" / "raw" / "characters"
RAW_UI = ROOT / "art" / "raw" / "ui"
OUT_SPRITES = ROOT / "client" / "public" / "sprites"
OUT_UI = ROOT / "client" / "public" / "ui"
CHARACTER_IDS = ["lemon", "raccoon", "icecream", "grandma", "sock", "cactus", "toast", "pigeon", "ghost", "blob"]
STATES = ["idle", "writing", "waiting", "win", "lose"]

KEY = (255, 0, 255)


def key_out_magenta(image: Image.Image, soft_lo: int = 40, soft_hi: int = 140) -> Image.Image:
    """Alpha from distance to pure magenta; despill the pink fringe on soft edges."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Magenta-ness: high R and B, low G.
            distance = max(abs(r - KEY[0]), abs(g - KEY[1]), abs(b - KEY[2]))
            if distance <= soft_lo:
                pixels[x, y] = (0, 0, 0, 0)
            elif distance < soft_hi:
                alpha = int(255 * (distance - soft_lo) / (soft_hi - soft_lo))
                # Despill: pull R/B toward G so the edge does not glow pink.
                r2 = min(r, g + (r - g) // 3)
                b2 = min(b, g + (b - g) // 3)
                pixels[x, y] = (r2, g, b2, min(a, alpha))
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


def process(source: Path, target: Path, size: int, dry_run: bool) -> None:
    print(f"{source.relative_to(ROOT)} -> {target.relative_to(ROOT)}")
    if dry_run:
        return
    with Image.open(source) as raw:
        keyed = key_out_magenta(raw)
    sprite = trim_and_square(keyed, size)
    target.parent.mkdir(parents=True, exist_ok=True)
    sprite.save(target, optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--size", type=int, default=512, help="output side length in px (default 512)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    manifest: dict[str, list[str]] = {}
    processed = 0
    if RAW_CHARACTERS.exists():
        for character_dir in sorted(p for p in RAW_CHARACTERS.iterdir() if p.is_dir()):
            if character_dir.name not in CHARACTER_IDS:
                print(f"skip unknown character folder {character_dir.name}", file=sys.stderr)
                continue
            for state_file in sorted(character_dir.glob("*.png")):
                if state_file.stem not in STATES:
                    print(f"skip unknown state {state_file}", file=sys.stderr)
                    continue
                process(state_file, OUT_SPRITES / character_dir.name / f"{state_file.stem}.png", args.size, args.dry_run)
                manifest.setdefault(character_dir.name, []).append(state_file.stem)
                processed += 1
    if RAW_UI.exists():
        for ui_file in sorted(RAW_UI.glob("*.png")):
            process(ui_file, OUT_UI / ui_file.name, args.size, args.dry_run)
            processed += 1

    if not args.dry_run:
        OUT_SPRITES.mkdir(parents=True, exist_ok=True)
        (OUT_SPRITES / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
        print(f"wrote {OUT_SPRITES.relative_to(ROOT)}/manifest.json")
    print(f"{processed} file(s) processed")
    if processed == 0:
        print("Nothing found under art/raw/. See ASSETS.md for the expected layout.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
