# Art asset requests

Everything the game renders today is code-drawn (SVG characters, CSS UI). Each item
below can be replaced by a generated image with **no code changes**: drop the PNGs
into `art/raw/`, run the chroma-key tool, commit the outputs.

```bash
uv run tools/dechroma.py        # magenta -> transparent, trim, square, resize to 512, write manifest
```

## Generation rules (apply to every image)

- **Background: solid pure magenta `#FF00FF`** filling the whole canvas, no gradient, no
  vignette, no shadow on the ground. The tool keys it out; anything pink-magenta in the
  subject itself will become transparent, so **no magenta/hot-pink in the artwork**
  (the ice cream is salmon/coral pink, not magenta; Roast flames are orange/yellow).
- Square canvas, **1024×1024**, PNG.
- Style, verbatim in every prompt: _flat vector illustration, thick dark navy outlines
  (#1A1A2E), 4–6 flat saturated fills, no gradients, no texture, no text, single
  character centered, full body visible, feet near the bottom, Jackbox party-game
  mascot style, readable as a silhouette at 64 px._
- One subject per image. No props except the ones listed for the pose.
- Keep each character's colors identical across its five poses (paste the character
  description into every pose prompt).

## Characters (10 × 5 poses = 50 images)

Path: `art/raw/characters/<id>/<state>.png` → served at `client/public/sprites/<id>/<state>.png`.

| id         | Character          | Description to paste into every prompt                                                                                           |
| ---------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `lemon`    | Smug Lemon         | A bright yellow oval lemon with a small green leaf on top, heavy-lidded unimpressed eyes, tiny smirk, stubby arms and legs       |
| `raccoon`  | Raccoon in a Tie   | A round grey raccoon with a black eye mask, striped ringed tail, cream belly, and a red office necktie                           |
| `icecream` | Melting Ice Cream  | A tan waffle cone with one coral-pink scoop, anxious wide eyes and a wobbly mouth, two drips running down the cone, stubby arms  |
| `grandma`  | Judgmental Grandma | A short grandma with a grey hair bun, large round glasses, lilac cardigan over a cream blouse, pursed disapproving lips          |
| `sock`     | Sock Puppet        | A tall salmon-orange sock with a sky-blue heel and toe, two big googly eyes and no other facial features                         |
| `cactus`   | Huggable Cactus    | A green saguaro cactus with two arm branches, a small coral flower on top, a hopeful smile, sitting in a terracotta pot          |
| `toast`    | Burnt Toast        | A square slice of toast, golden with a dark burnt patch, tiny deadpan dot eyes and a flat mouth, three little smoke wisps rising |
| `pigeon`   | City Pigeon        | A plump grey pigeon with an iridescent teal-purple neck patch, orange feet, beady orange eye, slightly disheveled                |
| `ghost`    | Shy Ghost          | A classic white bedsheet ghost with a wavy hem, pink blush cheeks, small nervous mouth, tiny nub arms                            |
| `blob`     | The Blob           | An amorphous teal blob with big round eyes and a wide grin, glossy highlight, no limbs                                           |

Poses (one prompt each, `<state>` is the filename):

| state     | Pose to describe                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `idle`    | Standing relaxed, neutral happy expression, arms at sides                                                                                                                                              |
| `writing` | Holding a short yellow pencil stub, scribbling on a small notepad, one sweat drop by the head, concentrating                                                                                           |
| `waiting` | Nervous, eyes glancing sideways, biting lip or grimacing, hands clasped, one sweat drop                                                                                                                |
| `win`     | Triumphant, one arm raised high having just dropped a black microphone, which is mid-air falling beside them; confident grin                                                                           |
| `lose`    | Deflated and squashed shorter, sad eyes, arms drooping (grandma: glasses slid down her nose; ghost: fading and drooping; toast: extra smoke; ice cream: melting harder; blob: spreading into a puddle) |

Suggested prompt skeleton:

> Flat vector illustration of [CHARACTER DESCRIPTION], [POSE]. Thick dark navy (#1A1A2E)
> outlines, 4–6 flat saturated fills, no gradients, no texture, no text, single character
> centered, full body visible, feet near the bottom, Jackbox party-game mascot style,
> readable as a silhouette at 64 px. Solid pure magenta #FF00FF background filling the
> entire square canvas, no shadow on the ground.

## UI images (optional, 8 images)

Path: `art/raw/ui/<name>.png` → `client/public/ui/<name>.png`. Not wired yet; when you
deliver them I swap the CSS-drawn versions.

| name               | What                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `logo`             | "SAY LESS" wordmark, "SAY" huge in yellow #FFD23F, "LESS" smaller and half-clipped below, chunky rounded letters, navy outline |
| `stamp-micdrop`    | Rubber-stamp style badge reading "MIC DROP!" in yellow on navy, slightly rotated                                               |
| `stamp-silenced`   | Rubber-stamp badge "SILENCED!" red on cream                                                                                    |
| `stamp-greatminds` | Rubber-stamp badge "GREAT MINDS" green on cream                                                                                |
| `stamp-backfire`   | Rubber-stamp badge "BACKFIRE!" orange on navy with small flame                                                                 |
| `mic`              | A black handheld stage microphone, flat vector, navy outline                                                                   |
| `flame`            | A stylized orange-yellow roast flame, flat vector, navy outline                                                                |
| `crown`            | A small gold crown for the winner, flat vector, navy outline                                                                   |

## After generating

1. Save files to the paths above (filenames are lowercase, exactly as listed).
2. `uv run tools/dechroma.py` – prints each conversion; check `client/public/sprites/<id>/*.png` look clean (open one; edges should not glow pink).
3. `npm run dev`, open a lobby, pick that character: the sprite replaces the SVG for every state listed in `client/public/sprites/manifest.json`.
4. Commit `client/public/sprites/**` and `client/public/sprites/manifest.json`. The raw magenta files under `art/raw/` are gitignored.

If an edge looks pink, re-run with a wider soft range: `uv run tools/dechroma.py --size 512` uses defaults; edit `soft_lo`/`soft_hi` in `tools/dechroma.py` (40/140) upward for softer keys.
