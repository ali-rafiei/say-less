# Character SVGs

Placeholder art for the twelve playable characters (the Reel Town cast minus the frog, plus duck,
otter, penguin and hedgehog; roster in `shared/src/characters.ts`). Each file is `<id>.svg` and
the game's CSS animates parts by class, so replacement art must keep this contract.
Final art is raster (see `ASSETS.md`); when a sprite exists for a state the SVG is not
rendered and `.char-sprite img` is animated as a whole instead.

## Root

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="char char-<id>">
```

No `width`/`height`, no `<style>`, no `<script>`, no `style=` attributes, no `id`
attributes (many copies render on one page), no external refs, gradients,
filters or `<text>`. Keep each file under 6 KB, coordinates as integers.

## Style

Flat vector: 4 to 6 saturated fills, every fill shape outlined with
`stroke="#1A1A2E" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`.
The character fills roughly 60-85% of the artboard and must read at 64px.

## Required groups

Direct children of the root, in this order, each present even if empty:

| class | contents |
|---|---|
| `c-shadow` | flat ellipse under the feet, `fill="#1A1A2E" opacity="0.15"`, no stroke |
| `c-body` | everything not listed below; contains `c-face` > `c-eyes` + `c-mouth` (may be nested deeper, e.g. inside a `c-head` group) |
| `c-arm-l` | left arm / wing / nub |
| `c-arm-r` | right arm; shoulder pivot near (330, 300) so a CSS rotate reads as raising the arm |
| `c-prop c-pencil` | pencil stub at the right hand, around (360, 300); hidden by default |
| `c-prop c-sweat` | one blue sweat drop near the upper right of the head; hidden by default |
| `c-gag` | character-specific detail the CSS animates: cat, monkey and otter tails and axolotl gills sway in idle; rabbit ears and axolotl gills droop on lose; fish bubbles rise; empty for bird, bear, duck and penguin |

Each class above appears exactly once per file.
