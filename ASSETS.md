# Art asset requests

The core art set is generated and wired: 60 character poses, 23 UI images, two app icons
and a share card. This document retains the generation prompts, source paths, grid orders
and output sizes. The generation record is summarised under "Art provenance" in the README;
the sources and full notes stay local in `art/`, which is gitignored.

How it works:

1. Open a fresh ChatGPT chat, attach the two reference images and paste the style block
   (section 1). Wait for ChatGPT to confirm.
2. Paste one prompt at a time. Each prompt is self-contained and repeats the background
   rules, because ChatGPT drifts between images.
3. Save each result to the path given under its prompt.
4. Run `uv run tools/dechroma.py`. It keys out the magenta, cuts each sheet into its cells,
   trims, squares, resizes to 512 x 512 and writes WebP files the game loads (about a fifth
   of the PNG size, which matters on a phone's data plan).

What the game uses today:

- **Character sprites are wired.** `client/src/components/Character.tsx` reads
  `client/public/sprites/manifest.json` and shows the painted image instead of the SVG for every
  character/pose listed there. The tool writes that manifest.
- **UI images are wired.** Stamps, icons, podium, how-to illustrations and the logo use
  `UIArt.tsx` and the generated `client/public/ui/manifest.json` bounds. App icons and the
  share card are linked from `client/index.html`. The logo fade and pose animations remain CSS.

## Progress

20 generations in total (12 character sheets, 4 UI sheets, 1 logo, 3 final files), plus two
optional sets.

| Done | Save ChatGPT's image as              | What                             | Grid, cells | The tool writes                              | Wired |
| ---- | ------------------------------------ | -------------------------------- | ----------- | -------------------------------------------- | ----- |
| [x]  | `art/raw/characters/cat.png`         | Cat, 5 poses                     | 3x2, 5      | `client/public/sprites/cat/<pose>.webp`      | yes   |
| [x]  | `art/raw/characters/monkey.png`      | Monkey, 5 poses                  | 3x2, 5      | `client/public/sprites/monkey/<pose>.webp`   | yes   |
| [x]  | `art/raw/characters/frog.png`        | Frog, 5 poses                    | 3x2, 5      | `client/public/sprites/frog/<pose>.webp`     | yes   |
| [x]  | `art/raw/characters/bird.png`        | Bird, 5 poses                    | 3x2, 5      | `client/public/sprites/bird/<pose>.webp`     | yes   |
| [x]  | `art/raw/characters/axolotl.png`     | Axolotl, 5 poses                 | 3x2, 5      | `client/public/sprites/axolotl/<pose>.webp`  | yes   |
| [x]  | `art/raw/characters/bear.png`        | Bear, 5 poses                    | 3x2, 5      | `client/public/sprites/bear/<pose>.webp`     | yes   |
| [x]  | `art/raw/characters/rabbit.png`      | Rabbit, 5 poses                  | 3x2, 5      | `client/public/sprites/rabbit/<pose>.webp`   | yes   |
| [x]  | `art/raw/characters/fish.png`        | Fish, 5 poses                    | 3x2, 5      | `client/public/sprites/fish/<pose>.webp`     | yes   |
| [x]  | `art/raw/characters/blob.png`        | Blob, 5 poses                    | 3x2, 5      | `client/public/sprites/blob/<pose>.webp`     | yes   |
| [x]  | `art/raw/characters/otter.png`       | Otter, 5 poses                   | 3x2, 5      | `client/public/sprites/otter/<pose>.webp`    | yes   |
| [x]  | `art/raw/characters/penguin.png`     | Penguin, 5 poses                 | 3x2, 5      | `client/public/sprites/penguin/<pose>.webp`  | yes   |
| [x]  | `art/raw/characters/hedgehog.png`    | Hedgehog, 5 poses                | 3x2, 5      | `client/public/sprites/hedgehog/<pose>.webp` | yes   |
| [x]  | `art/raw/sheets/stamps.png`          | Bonus stamps with text           | 3x2, 5      | `client/public/ui/<stamp>.webp`              | yes   |
| [x]  | `art/raw/sheets/icons.png`           | Icons (flame, crown, sound, ...) | 4x2, 8      | `client/public/ui/<icon>.webp`               | yes   |
| [x]  | `art/raw/sheets/podium.png`          | Podium stands 1, 2, 3            | 3x1, 3      | `client/public/ui/stand-<n>.webp`            | yes   |
| [x]  | `art/raw/sheets/howto.png`           | How-to-play illustrations        | 3x2, 6      | `client/public/ui/howto-<step>.webp`         | yes   |
| [x]  | `art/raw/ui/logo.png`                | SAY LESS wordmark                | single      | `client/public/ui/logo.webp`                 | yes   |
| [x]  | `client/public/icon-512.png`         | App icon, 512 x 512              | final file  | (not processed by the tool)                  | yes   |
| [x]  | `client/public/apple-touch-icon.png` | iOS home-screen icon, 180 x 180  | final file  | (not processed by the tool)                  | yes   |
| [x]  | `client/public/og-image.png`         | Link-preview card, 1200 x 630    | final file  | (not processed by the tool)                  | yes   |
| [ ]  | `client/public/ui/bg-<palette>.png`  | Optional: 6 background tiles     | final files | (not processed by the tool)                  | no    |
| [ ]  | `art/raw/later/confetti.png`         | Optional: confetti pieces        | 4x2, 8      | (not processed until it is wired)            | no    |

For the three final files, save ChatGPT's original under `art/raw/final/` and resize it into
place with the command given in section 3.6.

---

## 1. Before you start: references and the style block

The cast is the cast of Reel Town, so ChatGPT needs the Reel Town sheets to keep the
animals on-model. Start a **new chat** and attach both images:

- `/Users/e401621/Desktop/Code/zpersonal/reel-town/output/imagegen/reel-town-character-sheet.png`
  (the nine animals, front view)
- `/Users/e401621/Desktop/Code/zpersonal/reel-town/output/imagegen/reel-town-character-turnarounds.png`
  (front, side and back of each)

Then paste this block as the first message:

```
You are producing 2D game art for "Say Less", a party game played on phones. Its cast is
the cast of my other game, Reel Town, shown in the two attached reference sheets
(character models and turnarounds). Keep every returning animal exactly on-model: same
head and body silhouette, same proportions, same colours, same clothes. Use the references
for the characters and the rendering only, not for the layout: no cream page, no green
panels, no borders, no labels, no headings.

Look: match the attached references exactly. Early-2000s GameCube-era charm: simple
low-poly 3D models painted flat, visible tasteful faceting with gentle shading as if lit
from the upper left, matte surfaces, chunky clean rounded shapes, simple big graphic eyes,
warm muted colours. No outlines, no glossy toy rendering, no realistic fur, no plush
fabric, no photorealism, no drop shadows, no ground shadows.

Characters keep their own colours from the references. UI images (badges, icons, podium,
logo) use this game's palette, painted in the same faceted style:
ink navy #1A1A2E, paper cream #FFFAF0, yellow #FFD23F, orange #FF6B35, lime #C6FF3D,
teal #0B7A75, red #FF3D68 (a warm tomato red), green #3DDC84, deep purple #2D1B69,
podium navy #1B2A63, gold #FFD23F, silver #DFE3EE, bronze #E0A870.

Background rule for every image unless I say otherwise: a perfectly flat, uniform, pure
magenta #FF00FF background filling the entire canvas edge to edge. No gradient, no
vignette, no texture, no floor, no scenery. A script keys the magenta out, so do not use
magenta, hot pink, fuchsia or purple-pink anywhere in the art itself. Any pink in the art
must be a soft warm pink, peach, coral or salmon, clearly different from #FF00FF.

Sheets: I give a grid and a cell order. Place items left to right, top to bottom, one item
per cell, all at the same scale unless I say otherwise. Leave wide empty magenta gaps
between cells (at least a tenth of the canvas width), and never let an item touch or cross
into a neighbouring cell. Keep any small detached part of an item (a sweat drop, a falling
microphone, bubbles) close to its own item. No text unless I give the exact text.

Output a square image at 2048x2048 or larger unless I say otherwise. Confirm you
understand, then wait for the first sheet.
```

Why the game's hot pink `#FF5DA2` is missing from that palette: it is too close to the
magenta key, so the tool would make it partly see-through. The game keeps using it in CSS;
it just must not be painted into an image that goes through the tool.

---

## 2. Characters: 12 sheets

One sheet per animal, five poses each. The five poses are the whole set: **no animation
frames are needed.** Motion is added by CSS at runtime on top of the still (breathe in
idle, scribble while writing, bounce on a win, deflate on a loss), so each pose only has to
be a good still.

| id         | Name     | Accent    | Notes                                              |
| ---------- | -------- | --------- | -------------------------------------------------- |
| `cat`      | Cat      | `#EEA373` | Reel Town                                          |
| `monkey`   | Monkey   | `#9B6B45` | Reel Town                                          |
| `frog`     | Frog     | `#7FA35A` | Reel Town                                          |
| `bird`     | Bird     | `#5F7FB4` | Reel Town                                          |
| `axolotl`  | Axolotl  | `#F0B3BD` | Reel Town; the pink must stay pale, see its prompt |
| `bear`     | Bear     | `#8C6444` | Reel Town                                          |
| `rabbit`   | Rabbit   | `#F1E6D2` | Reel Town                                          |
| `fish`     | Fish     | `#6FC0B4` | Reel Town                                          |
| `blob`     | Blob     | `#A8D1B8` | Reel Town                                          |
| `otter`    | Otter    | `#B08968` | new, designed in the same language                 |
| `penguin`  | Penguin  | `#555D83` | new, designed in the same language                 |
| `hedgehog` | Hedgehog | `#8C7265` | new, designed in the same language                 |

The accent is the colour the game paints behind a character's name chip and vote bar.

**Sheet layout (every character):** square 2048 x 2048, 3 columns x 2 rows.

| Row | Left   | Middle    | Right        |
| --- | ------ | --------- | ------------ |
| 1   | `idle` | `writing` | `waiting`    |
| 2   | `win`  | `lose`    | (empty cell) |

**Where each pose appears**, so you know what matters most:

| Pose      | Where the game shows it                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`    | Lobby character grid, lobby player chips (56 px), roast targets (44 px), voter faces on reveal cards (26 px, the smallest use), tie cards, middle of the scoreboard, podium 2nd place, final-round list |
| `writing` | Corner mascot while you type (84 px), "Waiting on..." chips of players still writing                                                                                                                    |
| `waiting` | Voting screen when one of the two answers is yours (96 px)                                                                                                                                              |
| `win`     | Your own pick in the lobby grid, winning reveal card, scoreboard leader, podium 1st place (110 px), full-screen mic-drop overlay (220 px, the largest use)                                              |
| `lose`    | Losing reveal card, scoreboard last place, podium 3rd place                                                                                                                                             |

Every pose must read as a silhouette at about 26 px, so big shapes beat small details.

**Later, not wired now:** if the small chips (26 to 56 px) look muddy with full-body
sprites, a second pass can add a head-and-shoulders `portrait` per character. The game has
no slot for it yet; do not generate it now.

### 2.1 Cat

Save as `art/raw/characters/cat.png`

```
Sheet: Cat character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (keep on-model with the Cat in the attached references): angular wide triangular
cheek/head silhouette, tall triangular ears with soft coral-pink inner ears (warm, not
magenta), small pointed muzzle with tiny nose and W smile, sleepy graphic eyes, orange
tabby markings and cream cheeks, slim short tapered body with a dark teal simple shirt,
orange tabby legs, visible curved striped tail and small paws.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including ears and tail. All five poses at exactly the same scale, feet on the
same baseline height in every cell, the character filling about 70% of the cell height.
Wide empty magenta gaps between cells; nothing touches or crosses into a neighbouring
cell. No labels, no panels, no borders.

Poses:
1. idle: standing relaxed, arms at its sides, neutral happy expression.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser, no pink)
   and scribbling on a small cream notepad held in the other paw, concentrating, one small
   pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, biting its lip or grimacing, paws clasped in
   front of the chest, one small pale-blue sweat drop just beside the head.
4. win: triumphant, one arm raised high, having just let go of a black handheld microphone
   that is falling mid-air right beside the raised paw, close to the body; confident grin.
5. lose: deflated and squashed noticeably shorter, sad eyes, arms drooping, ears pressed
   flat against the head.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no speech bubbles, no motion lines, no stars, no confetti.
```

### 2.2 Monkey

Save as `art/raw/characters/monkey.png`

```
Sheet: Monkey character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (keep on-model with the Monkey in the attached references): large circular
cupped ears with light inner ears, small projecting cream oval muzzle with tiny nostrils
and a short dark mouth, peanut-shaped brown head with a cream face mask, narrow shoulders,
pear-shaped small torso, longer gently curved arms, big mitten hands, short bent legs, a
looping tail, muted mustard shirt.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including the tail. All five poses at exactly the same scale, feet on the
same baseline height in every cell, the character filling about 70% of the cell height.
Wide empty magenta gaps between cells; nothing touches or crosses into a neighbouring
cell. No labels, no panels, no borders.

Poses:
1. idle: standing relaxed, arms at its sides, neutral happy expression, tail in its usual
   loop.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser, no pink) in
   one mitten hand and scribbling on a small cream notepad held in the other, concentrating,
   one small pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, biting its lip or grimacing, hands clasped in
   front of the chest, one small pale-blue sweat drop just beside the head.
4. win: triumphant, one long arm raised high, having just let go of a black handheld
   microphone that is falling mid-air right beside the raised hand, close to the body;
   confident grin.
5. lose: deflated and squashed noticeably shorter, sad eyes, arms drooping, the tail hanging
   limp and drooping to the ground instead of looping.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no speech bubbles, no motion lines, no stars, no confetti.
```

### 2.3 Frog

Save as `art/raw/characters/frog.png`

```
Sheet: Frog character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (keep on-model with the Frog in the attached references): broad flattened head
with integrated raised eye bumps, huge wide simple smile, squat broad green body, very
short arms and large splayed webbed feet, a short blue vest with two small buttons, cream
lower face and belly. Clearly frog anatomy.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including the feet. All five poses at exactly the same scale, feet on the same
baseline height in every cell, the character filling about 70% of the cell height. Wide
empty magenta gaps between cells; nothing touches or crosses into a neighbouring cell. No
labels, no panels, no borders.

Poses:
1. idle: standing relaxed, short arms at its sides, neutral happy wide smile.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser, no pink) and
   scribbling on a small cream notepad held in the other hand, concentrating, one small
   pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, a tight wobbly grimace instead of the smile,
   hands clasped in front of the belly, one small pale-blue sweat drop just beside the head.
4. win: triumphant, one short arm raised high, having just let go of a black handheld
   microphone that is falling mid-air right beside the raised hand, close to the body;
   confident huge grin.
5. lose: deflated and squashed noticeably shorter and wider, sad eyes, arms drooping, the
   eye bumps drooping and half-lidded, sagging down the sides of the head.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no speech bubbles, no motion lines, no stars, no confetti.
```

### 2.4 Bird

Save as `art/raw/characters/bird.png`

```
Sheet: Bird character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (keep on-model with the Bird in the attached references): compact pear/teardrop
silhouette, small head blended into a plump breast, ochre beak, blue-grey crown with a tiny
upright crest, rust breast, tapered blue-grey wings instead of hands, small thin legs and
three-toed feet, a simple cream and teal knit vest with a zigzag band. It holds things with
its wing-tip feathers.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including the crest and feet. All five poses at exactly the same scale, feet
on the same baseline height in every cell, the character filling about 70% of the cell
height. Wide empty magenta gaps between cells; nothing touches or crosses into a
neighbouring cell. No labels, no panels, no borders.

Poses:
1. idle: standing relaxed, wings folded at its sides, neutral happy expression, crest up.
2. writing: gripping a short yellow pencil stub (grey metal band, cream eraser, no pink) in
   one wing tip and scribbling on a small cream notepad held by the other wing,
   concentrating, one small pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, beak pressed shut in a grimace, wing tips
   clasped together in front of the breast, one small pale-blue sweat drop just beside the
   head.
4. win: triumphant, one wing raised high, having just let go of a black handheld
   microphone that is falling mid-air right beside the raised wing, close to the body;
   confident expression.
5. lose: deflated and squashed noticeably shorter and rounder, sad eyes, wings drooping,
   the crest lying flat on the head.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no speech bubbles, no motion lines, no stars, no confetti,
no loose feathers.
```

### 2.5 Axolotl

Save as `art/raw/characters/axolotl.png`

```
Sheet: Axolotl character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Colour warning for this character: the axolotl's body is a pale, milky, warm pink #F0B3BD
and its gills are a soft coral. Both are far from the magenta background #FF00FF and must
stay that way. Do not saturate them or shift them toward magenta, hot pink, fuchsia or
purple-pink. Its top is a muted dusty grey-lavender, not a pink-purple.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (keep on-model with the Axolotl in the attached references): wide rounded
rectangular head, widely spaced tiny eyes and a little smile, three chunky coral gill
branches on each side, pale pink elongated low pear body, short delicate limbs and a
visible thick tapered tail with a fin edge, a muted dusty grey-lavender simple sleeveless
top.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including all gills and the tail. All five poses at exactly the same scale,
feet on the same baseline height in every cell, the character filling about 70% of the
cell height. Wide empty magenta gaps between cells; nothing touches or crosses into a
neighbouring cell. No labels, no panels, no borders.

Poses:
1. idle: standing relaxed, arms at its sides, neutral happy little smile, gills up and
   spread.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser, no pink) and
   scribbling on a small cream notepad held in the other hand, concentrating, one small
   pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, a small grimace, hands clasped in front of the
   chest, one small pale-blue sweat drop just beside the head.
4. win: triumphant, one arm raised high, having just let go of a black handheld microphone
   that is falling mid-air right beside the raised hand, close to the body; confident grin,
   gills perked up.
5. lose: deflated and squashed noticeably shorter, sad eyes, arms drooping, all six gill
   branches drooping down limply beside the head.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no speech bubbles, no motion lines, no stars, no confetti.
```

### 2.6 Bear

Save as `art/raw/characters/bear.png`

```
Sheet: Bear character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (keep on-model with the Bear in the attached references): noticeably the largest
and broadest silhouette of the cast, soft squared head, small round ears, prominent cream
muzzle with a dark nose, heavy barrel-shaped brown torso, thick forearms, broad feet, a
forest green sweater with a single cream horizontal stripe, gentle eyebrow expression.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible. All five poses at exactly the same scale, feet on the same baseline height in
every cell, the character filling about 70% of the cell height. Wide empty magenta gaps
between cells; nothing touches or crosses into a neighbouring cell. No labels, no panels,
no borders.

Poses:
1. idle: standing relaxed, thick arms at its sides, neutral happy expression.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser, no pink),
   tiny in its big paw, scribbling on a small cream notepad held in the other paw,
   concentrating with furrowed eyebrows, one small pale-blue sweat drop just beside the
   head.
3. waiting: nervous, eyes glancing sideways, worried eyebrows, a grimace, paws clasped in
   front of the belly, one small pale-blue sweat drop just beside the head.
4. win: triumphant, one arm raised high, having just let go of a black handheld microphone
   that is falling mid-air right beside the raised paw, close to the body; confident grin.
5. lose: deflated and squashed noticeably shorter, sad eyes, arms drooping, the whole body
   slumped forward with rounded shoulders and a hanging head.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no speech bubbles, no motion lines, no stars, no confetti.
```

### 2.7 Rabbit

Save as `art/raw/characters/rabbit.png`

```
Sheet: Rabbit character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (keep on-model with the Rabbit in the attached references): tall narrow oval
head, very long ears with one slightly tilted and soft peach-pink inner ears (warm, not
magenta), rounded split cheeks with a peach blush, tiny nose, narrow shoulders, wider hips,
long oversized hind feet, cream fur, a faded rust short dress/tunic, a small round tail.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including the full length of both ears. All five poses at exactly the same
scale, feet on the same baseline height in every cell, the character filling about 70% of
the cell height. Wide empty magenta gaps between cells; nothing touches or crosses into a
neighbouring cell. No labels, no panels, no borders.

Poses:
1. idle: standing relaxed, arms at its sides, neutral happy expression, ears up.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser, no pink) and
   scribbling on a small cream notepad held in the other paw, concentrating, one small
   pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, biting its lip, paws clasped in front of the
   chest, one small pale-blue sweat drop just beside the head.
4. win: triumphant, one arm raised high, having just let go of a black handheld microphone
   that is falling mid-air right beside the raised paw, close to the body; confident grin.
5. lose: deflated and squashed noticeably shorter, sad eyes, arms drooping, both long ears
   flopped forward over the face.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no speech bubbles, no motion lines, no stars, no confetti.
```

### 2.8 Fish

Save as `art/raw/characters/fish.png`

```
Sheet: Fish character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (keep on-model with the Fish in the attached references): an upright
anthropomorphic fish with a continuous diamond/oval fish-shaped head and torso, turquoise
scaled colour blocks, a small puckered coral mouth (warm coral, not pink-magenta), eyes far
apart, a prominent dorsal fin, side fins as arms and two little fin-like feet, a visible fan
tail, a simple mustard vest fitted to the fish body. It must not be a human body topped
with a fish head. It holds things with its side fins.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including the dorsal fin and tail. All five poses at exactly the same scale,
feet on the same baseline height in every cell, the character filling about 70% of the
cell height. Wide empty magenta gaps between cells; nothing touches or crosses into a
neighbouring cell. No labels, no panels, no borders.

Poses:
1. idle: standing relaxed, side fins at its sides, neutral happy expression.
2. writing: gripping a short yellow pencil stub (grey metal band, cream eraser, no pink) in
   one side fin and scribbling on a small cream notepad held by the other fin,
   concentrating, one small pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, mouth pressed into a grimace, fins clasped in
   front of the body, one small pale-blue sweat drop just beside the head.
4. win: triumphant, one fin raised high, having just let go of a black handheld microphone
   that is falling mid-air right beside the raised fin, close to the body; confident grin.
5. lose: deflated and squashed noticeably shorter, sad eyes, fins drooping, mouth open wide
   and gasping like a fish out of water, with two or three small pale-blue bubbles rising
   right next to the mouth, touching or nearly touching the head.

Props: only the pencil, notepad, sweat drop, microphone and bubbles named above, each kept
close to the character. No other objects, no water, no speech bubbles, no motion lines, no
stars, no confetti.
```

### 2.9 Blob

Save as `art/raw/characters/blob.png`

```
Sheet: Blob character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (keep on-model with the Blob in the attached references): a low asymmetrical
mint-green bean / gumdrop creature, head and body one continuous shape without a neck, two
tiny eyes and an off-center friendly smile, soft green cheek spots, tiny side flipper nubs
and two integrated broad foot lobes, a simple darker teal lower-body colour patch. No
conventional spherical head or humanoid torso. It holds things with its side nubs.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible. All five poses at exactly the same scale, foot lobes on the same baseline
height in every cell, the character filling about 70% of the cell height. Wide empty
magenta gaps between cells; nothing touches or crosses into a neighbouring cell. No labels,
no panels, no borders.

Poses:
1. idle: sitting relaxed on its foot lobes, nubs at its sides, neutral happy smile.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser, no pink) in
   one nub and scribbling on a small cream notepad held by the other nub, concentrating,
   one small pale-blue sweat drop just beside the top of the body.
3. waiting: nervous, eyes glancing sideways, a wobbly grimace, nubs pressed together in
   front of the body, one small pale-blue sweat drop just beside the top of the body.
4. win: triumphant, stretched a little taller, one nub raised high, having just let go of a
   black handheld microphone that is falling mid-air right beside the raised nub, close to
   the body; confident grin.
5. lose: deflated, sad eyes, the whole body sagging and spreading out sideways into a low
   wide puddle on the ground, eyes and mouth still on top, nubs flattened into the puddle.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no speech bubbles, no motion lines, no stars, no confetti.
```

### 2.10 Otter

Save as `art/raw/characters/otter.png`

```
Sheet: Otter character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (a new member of the same cast, designed in the same language as the attached
references: its own distinct head and body silhouette, economical, buildable as a simple
game model, cute with quirky personality): a long low rounded body, small round ears, a
broad pale muzzle with whiskers and a dark nose, a thick tapered tail, webbed paws usually
held together at the chest, a sleepy content half-smile, warm brown coat #B08968 with a
pale cream belly, and a simple cream knit vest.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including the tail. All five poses at exactly the same scale, feet (or the
body resting on the ground) on the same baseline height in every cell, the character
filling about 70% of the cell height when standing. Wide empty magenta gaps between cells;
nothing touches or crosses into a neighbouring cell. No labels, no panels, no borders.

Poses:
1. idle: standing relaxed on its hind feet, webbed paws held together at the chest, sleepy
   content half-smile.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser, no pink) and
   scribbling on a small cream notepad held in the other paw, concentrating, one small
   pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, a small grimace, paws clasped tightly at the
   chest, tail curled around its feet, one small pale-blue sweat drop just beside the head.
4. win: triumphant, one arm raised high, having just let go of a black handheld microphone
   that is falling mid-air right beside the raised paw, close to the body; confident grin.
5. lose: deflated, sad eyes, lying flat on its back on the ground, belly up, paws and feet
   limp in the air, tail flat.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no water, no speech bubbles, no motion lines, no stars, no
confetti.
```

### 2.11 Penguin

Save as `art/raw/characters/penguin.png`

```
Sheet: Penguin character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (a new member of the same cast, designed in the same language as the attached
references: its own distinct head and body silhouette, economical, buildable as a simple
game model, cute with quirky personality): an egg-shaped body with the head merged into it
(no neck), a white belly and face patch, a small orange beak, stubby flippers instead of
arms, orange webbed feet, a slate blue-grey back #555D83, and a small striped scarf in
cream and mustard. It holds things by pinching them in its flippers.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including the feet. All five poses at exactly the same scale, feet (or the
body resting on the ground) on the same baseline height in every cell, the character
filling about 70% of the cell height when standing. Wide empty magenta gaps between cells;
nothing touches or crosses into a neighbouring cell. No labels, no panels, no borders.

Poses:
1. idle: standing relaxed, flippers at its sides, neutral happy expression.
2. writing: pinching a short yellow pencil stub (grey metal band, cream eraser, no pink) in
   one flipper and scribbling on a small cream notepad held by the other flipper,
   concentrating, one small pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, beak clamped shut in a grimace, flipper tips
   pressed together in front of the belly, one small pale-blue sweat drop just beside the
   head.
4. win: triumphant, one flipper raised high, having just let go of a black handheld
   microphone that is falling mid-air right beside the raised flipper, close to the body;
   confident expression.
5. lose: deflated, sad eyes, flopped face-down onto its belly on the ground, flippers
   spread flat, feet sticking up behind.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no ice, no snow, no speech bubbles, no motion lines, no
stars, no confetti.
```

### 2.12 Hedgehog

Save as `art/raw/characters/hedgehog.png`

```
Sheet: Hedgehog character poses, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the attached Reel Town style: soft low-poly model painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no text, no ground shadow.

Character (a new member of the same cast, designed in the same language as the attached
references: its own distinct head and body silhouette, economical, buildable as a simple
game model, cute with quirky personality): a compact round body, back and crown covered
in chunky blunt faceted spikes in a greyish cocoa brown #8C7265, a soft tan face and
belly, a small pointed snout with a dark nose, tiny round ears, stubby limbs, one small
green leaf stuck in the spikes, and a plain sage-green tee.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell with nothing in
it. One full-body pose per cell, front-facing or a very slight three-quarter view, whole
body visible including the spikes. All five poses at exactly the same scale, feet (or the
body resting on the ground) on the same baseline height in every cell, the character
filling about 70% of the cell height when standing. Wide empty magenta gaps between cells;
nothing touches or crosses into a neighbouring cell. No labels, no panels, no borders.

Poses:
1. idle: standing relaxed, stubby arms at its sides, neutral happy expression, the leaf in
   its spikes.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser, no pink) and
   scribbling on a small cream notepad held in the other hand, concentrating, one small
   pale-blue sweat drop just beside the head.
3. waiting: nervous, eyes glancing sideways, a small grimace, hands clasped in front of the
   belly, spikes slightly bristled, one small pale-blue sweat drop just beside the head.
4. win: triumphant, one stubby arm raised high, having just let go of a black handheld
   microphone that is falling mid-air right beside the raised hand, close to the body;
   confident grin.
5. lose: deflated, sad eyes peeking out, half-curled into a ball on the ground, spikes
   outward, face and belly partly tucked in, the leaf still stuck in the spikes.

Props: only the pencil, notepad, sweat drop and microphone named above, each kept close to
the character. No other objects, no speech bubbles, no motion lines, no stars, no confetti.
```

---

## 3. UI images

**All core UI images are wired.** The tool cuts them into `client/public/ui/` and writes
painted bounds to its manifest so `UIArt.tsx` can display wide badges without square padding. The cell order in each prompt matches the tool's `SHEETS` table
exactly; do not reorder.

Complete inventory (the middle column records the former placeholder):

| File (in `client/public/ui/`)               | Replaces today                                      | Where it shows                                                                                    |
| ------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `micdrop.png`                               | CSS stamp "MIC DROP!" and the giant "MIC DROP" text | Winning reveal card; the full-screen mic-drop overlay                                             |
| `silenced.png`                              | CSS stamp "SILENCED!"                               | Reveal card of a winner who took every vote                                                       |
| `greatminds.png`                            | CSS stamp and banner "GREAT MINDS"                  | Both reveal cards, and the banner above them, when the two answers match                          |
| `backfire.png`                              | CSS stamp "BACKFIRE!"                               | Reveal card of a roasted player who won and stole the roaster's points                            |
| `robbed.png`                                | CSS stamp "ROBBED"                                  | Reveal card of the roaster who lost those points                                                  |
| `flame.png`                                 | the flame emoji, in four places                     | "You've been roasted" overlay, "Roast window" heading, "roasted" tag on a prompt, reveal footnote |
| `crown.png`                                 | the crown emoji                                     | Leader's chip in the lobby; before the winner's name on the podium                                |
| `sound-on.png`, `sound-off.png`             | the speaker emoji pair                              | Mute button in the header of every in-game screen                                                 |
| `mic.png`                                   | nothing yet                                         | Mic-drop overlay                                                                                  |
| `pencil.png`                                | nothing yet                                         | Writing phase (next to players still writing)                                                     |
| `tile.png`                                  | CSS word-budget tile                                | Header during writing (one tile per word left); the round intro, where the lost tiles shatter     |
| `seat.png`                                  | dashed circle with "?"                              | Empty lobby seats for players who have not joined                                                 |
| `stand-1.png`, `stand-2.png`, `stand-3.png` | CSS podium blocks                                   | Podium screen, placed 2-1-3                                                                       |
| `howto-gather.png` ... `howto-final.png`    | text only                                           | The "How to play" dialog on the home screen, one per step                                         |
| `logo.png`                                  | CSS wordmark                                        | Home screen                                                                                       |

### 3.1 Stamps sheet

Save as `art/raw/sheets/stamps.png` (3 columns x 2 rows; order: `micdrop`, `silenced`,
`greatminds`, `backfire`, `robbed`, empty).

The game slams these onto the top-right corner of the reveal cards (about 90 px wide) and
shows MIC DROP again across the whole screen (about 390 px wide), so the text must be crisp
at both sizes. The game tilts them itself, so they are drawn straight.

```
Sheet: bonus stamps, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the badges.

Style: the attached Reel Town painted low-poly style applied to flat objects: chunky
rounded shapes, gentle faceted shading lit from the upper left, matte, no outlines, no drop
shadows.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: MIC DROP!,
SILENCED!, GREAT MINDS. Row 2, left to right: BACKFIRE!, ROBBED, then an empty
bottom-right cell with nothing in it. Each badge centred in its cell, about 75% of the cell
width, all at the same scale, wide empty magenta gaps between them, nothing touching.

Each badge is a rubber-stamp impression: a rounded rectangle with a double border line,
slightly worn ink texture at the edges, the text in chunky rounded bold capitals (like the
Fredoka font) spelled exactly as given, on one line, perfectly horizontal and not rotated.
1. "MIC DROP!": yellow #FFD23F letters and border on a navy #1A1A2E badge.
2. "SILENCED!": warm tomato red #FF3D68 letters and border on a cream #FFFAF0 badge.
3. "GREAT MINDS": green #3DDC84 border, letters in a deeper shade of the same green so they
   read clearly, on a cream #FFFAF0 badge.
4. "BACKFIRE!": orange #FF6B35 letters and border on a navy #1A1A2E badge, with a small
   orange-and-yellow flame licking up from the top-right corner, touching the badge.
5. "ROBBED": dark slate grey #5A5F6B letters and border on a cream #FFFAF0 badge,
   slightly cracked: one crack line runs across a corner, the pieces still in place.

No other text, no stars, no speech bubbles, no extra items.
```

### 3.2 Icons sheet

Save as `art/raw/sheets/icons.png` (4 columns x 2 rows; order: `flame`, `crown`, `sound-on`,
`sound-off`, `mic`, `pencil`, `tile`, `seat`).

Icons show as small as 20 px (the leader crown) and sit on both dark phase backgrounds and
cream cards and buttons, so each needs a strong silhouette and its own contrast.

```
Sheet: UI icons, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the icons.

Style: the attached Reel Town painted low-poly style: each icon a single chunky painted
object, gentle faceted shading lit from the upper left, matte, no outlines, no drop
shadows. Readable at 20 pixels.

Layout: square 2048x2048 canvas, 4 columns x 2 rows. Each icon centred in its cell,
filling about 65% of it, front or three-quarter view, all at the same visual scale, wide
empty magenta gaps between them, nothing touching.
Row 1, left to right:
1. flame: a stylised roast flame, orange #FF6B35 outside, yellow #FFD23F core, three
   licking tongues, no pink or red-pink.
2. crown: a small chunky gold #FFD23F crown with three rounded points and a cream band.
3. sound-on: a chunky navy #1A1A2E speaker with a cream cone and two curved yellow
   #FFD23F sound waves beside it, touching or nearly touching the speaker.
4. sound-off: the same speaker with the waves replaced by a small red #FF3D68 X right
   beside the cone.
Row 2, left to right:
5. mic: a black handheld stage microphone, dark grey mesh head, thin silver band, angled
   slightly.
6. pencil: a short yellow #FFD23F pencil stub, sharpened tan wooden tip, grey metal band
   and a cream eraser (no pink eraser), angled for writing.
7. tile: one word-budget tile, seen from the front, like a chunky game tile, slightly
   taller than wide (about 4:5): a yellow #FFD23F face, cream #FFFAF0 bevelled sides, and a
   navy #1A1A2E band along the bottom showing its thickness. Blank, no letter.
8. seat: an empty seat for a player who has not joined: a soft light grey rounded
   silhouette of a generic small creature (no species features), with a large dark slate
   grey #5A5F6B "?" on its chest.

No other text, no extra items.
```

### 3.3 Podium sheet

Save as `art/raw/sheets/podium.png` (3 columns x 1 row; order: `stand-1`, `stand-2`,
`stand-3`).

The game places them side by side in 2-1-3 order with the winners standing on top, and
writes each player's score on the stand. The tool keeps the three at one shared scale and
one baseline, so their height difference survives.

```
Sheet: podium stands, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the stands.

Style: the attached Reel Town painted low-poly style: chunky blocks, gentle faceted
shading lit from the upper left, matte, no outlines, no drop shadows.

Layout: landscape canvas 2048 wide, 3 columns x 1 row, left to right: first place, second
place, third place. Front view, straight on, no perspective. All three exactly the same
width and at the same scale, their bottom edges on one shared baseline, wide empty magenta
gaps between them, nothing touching.
1. first place: gold #FFD23F block, about three quarters as tall as it is wide, a big navy
   #1A1A2E numeral "1" on the front.
2. second place: silver #DFE3EE block, about half as tall as it is wide, a big navy numeral
   "2" on the front.
3. third place: bronze #E0A870 block, about two fifths as tall as it is wide, a big navy
   numeral "3" on the front.
Each block has slightly rounded top corners, a flat top for characters to stand on, and a
plain flat band across the front below the numeral where the game will write the score.
No characters, no steps, no stars, no other text.
```

### 3.4 How-to-play sheet

Save as `art/raw/sheets/howto.png` (3 columns x 2 rows; order: `howto-gather`,
`howto-answer`, `howto-vote`, `howto-micdrop`, `howto-roast`, `howto-final`).

One small square illustration per step of the "How to play" dialog on the home screen.
Attach the Reel Town character sheet again with this prompt so the cast stays on-model.

```
Sheet: how-to-play illustrations, for the game Say Less. Use the attached Reel Town cast.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the illustrations.

Style: exactly the attached Reel Town style: soft low-poly characters painted flat, gentle
faceted shading lit from the upper left, matte, simple big graphic eyes, warm muted
colours, no outlines, no ground shadows. Props use the game palette: navy #1A1A2E, cream
#FFFAF0, yellow #FFD23F, orange #FF6B35, lime #C6FF3D, teal #0B7A75.

Layout: square 2048x2048 canvas, 3 columns x 2 rows, one illustration per cell, each a
compact vignette filling about 70% of its cell. Within a vignette the characters and props
overlap or touch so it reads as one cluster, with nothing floating loose. Wide empty
magenta gaps between cells, nothing crossing into a neighbouring cell, no scenery, no
frames.
Row 1, left to right:
1. gather: the Cat, the Frog and the Bear huddled together, each holding a phone, around a
   cream card showing the room code "KZPW".
2. answer: the Rabbit writing on a small notepad with a yellow pencil, a row of yellow word
   tiles floating just above it with the last few tiles cracking and falling away.
3. vote: two cream answer cards side by side labelled "A" and "B", the Bird and the Monkey
   in front of them, each pointing at a different card.
Row 2, left to right:
4. mic drop: the Otter with one arm raised, a black handheld microphone falling right
   beside its paw, confident grin.
5. roast: the Fish holding up an orange roast flame toward the Hedgehog, whose row of word
   tiles above its head is burning down to just two tiles.
6. final: a small three-step podium, gold in the middle, silver left, bronze right, with
   the Cat on gold, the Bear on silver and the Penguin on bronze.

The only text allowed is "KZPW", "A" and "B". No other text, no captions.
```

The Otter, Penguin and Hedgehog are not in the reference sheets. If they come out off-model,
paste their character description from section 2 into this prompt.

### 3.5 Logo (single image)

Save as `art/raw/ui/logo.png`

How the game draws it now (`.logo__say` / `.logo__less` in `client/src/styles/screens.css`):
"SAY" is huge and yellow with a navy edge and a hard navy drop shadow offset down-right.
"LESS" sits beneath it, about 45% of the size, cream, with very wide letter spacing, and it
fades out: solid for the top 55% of its height, then fading to fully transparent at its
bottom edge, as if the word is being cut off mid-sentence. Paint LESS **solid**: a fade
painted into the magenta keys out as a grey-pink smear, so the game applies the same fade
as a CSS mask over the wired image.

```
Single image: the "SAY LESS" wordmark, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the letters.

Style: the attached Reel Town painted low-poly look applied to lettering: chunky rounded
bold capitals (like the Fredoka font), each letter a thick solid slab with gentle faceted
shading lit from the upper left, matte.

Composition: square 2048x2048 canvas, the wordmark centred and filling about 80% of the
width, on two lines. Line 1: "SAY", huge, yellow #FFD23F letters with a navy #1A1A2E edge
and a hard navy drop shadow offset down and to the right. Line 2, tight beneath it:
"LESS", about 45% of the height of SAY, cream #FFFAF0 letters with a navy #1A1A2E edge,
very wide letter spacing so LESS is about as wide as SAY. Paint LESS completely solid, with
no fade and nothing cut off. The two words touch or nearly touch so the logo is one
cluster.

No other text, no mascot, no sparkles, no background shapes.
```

### 3.6 Final files: app icons and share card (no magenta, not processed)

These three are finished files with solid backgrounds. They skip the tool: save ChatGPT's
original under `art/raw/final/` (gitignored), then resize it into place:

```bash
uv run --with pillow python -c "from PIL import Image, ImageOps; ImageOps.fit(Image.open('art/raw/final/icon.png').convert('RGBA'), (512, 512), Image.LANCZOS).save('client/public/icon-512.png')"
uv run --with pillow python -c "from PIL import Image, ImageOps; ImageOps.fit(Image.open('art/raw/final/apple-touch.png').convert('RGB'), (180, 180), Image.LANCZOS).save('client/public/apple-touch-icon.png')"
uv run --with pillow python -c "from PIL import Image, ImageOps; ImageOps.fit(Image.open('art/raw/final/og.png').convert('RGB'), (1200, 630), Image.LANCZOS).save('client/public/og-image.png')"
```

`ImageOps.fit` scales and centre-crops to the exact size.

The corresponding tags are now in `client/index.html`: `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, a PNG
icon link for `icon-512.png`, and the share-card tags (`og:title`, `og:description`,
`og:image` with an absolute URL, `twitter:card`). The browser-tab icon `favicon.png` (64 x 64)
is cut from the same `art/raw/final/icon.png` with rounded corners, replacing the old
code-drawn `favicon.svg`. `og:image` points at the GitHub Pages copy, because link-preview
crawlers mostly fetch over IPv4 and the game server is IPv6-only.

**App icon.** Save as `art/raw/final/icon.png` -> `client/public/icon-512.png`

```
Single image: the app icon for the game Say Less. This is a finished icon: ignore the
magenta background rule for this image only, and use no magenta or hot pink anywhere.

Style: the attached Reel Town painted low-poly look: chunky rounded shapes, gentle faceted
shading lit from the upper left, matte, no outlines.

Composition: square 1024x1024. A navy #1A1A2E rounded square filling the whole canvas
with rounded corners (transparent outside the corners if you can; otherwise fill the
corners with the same navy). Centred on it, large and simple: the letters "SL" in chunky
rounded bold yellow #FFD23F capitals with a small hard navy drop shadow, OR a single black
handheld microphone with a yellow band, whichever reads better. It must still read clearly
at 32 pixels: one bold shape, big margins, nothing thin. No other text, no small details.
```

**iOS home-screen icon.** Save as `art/raw/final/apple-touch.png` ->
`client/public/apple-touch-icon.png`

```
Single image: the iOS home-screen icon for the game Say Less. This is a finished icon:
ignore the magenta background rule for this image only, and use no magenta or hot pink
anywhere.

Same design as the app icon you just made, but as a full-bleed square: the navy #1A1A2E
background fills the entire 1024x1024 canvas edge to edge with square corners and no
rounding (iOS rounds it). Keep the "SL" (or the microphone) centred with generous margins
so it reads at 32 pixels. No other text.
```

**Link-preview card.** Save as `art/raw/final/og.png` -> `client/public/og-image.png`

```
Single image: the link-preview card for the game Say Less, shown when the game's link is
shared in a chat. This is a finished image: ignore the magenta background rule for this
image only, and use no magenta or hot pink anywhere.

Style: the attached Reel Town painted low-poly look for the characters and lettering,
gentle faceted shading lit from the upper left, matte, no outlines.

Composition: landscape 1536x1024. It will be cropped to 1200x630 from the centre, so keep
everything important inside the central band 1536 wide by 806 tall. Background: navy
#1A1A2E with a soft lighter glow of #2D2B55 at the top centre. Left half: the wordmark,
"SAY" huge in yellow #FFD23F with a navy edge and hard drop shadow, "LESS" beneath it in
cream #FFFAF0, smaller with wide letter spacing, and under that the tagline in cream
rounded bold letters: "Everyone's got something to say. You've got fewer words to say it."
Right half: four cast members from the attached references, the Cat, the Frog, the Bear and
the Axolotl (pale pink, not magenta), standing together, one of them dropping a black
handheld microphone. Spell the text exactly as given. No other text.
```

### 3.7 Optional, not wired: background tiles and confetti

Nothing reads these yet. Make them only if you want them ready for later.

**Background tiles**, one per phase palette. Full-bleed, so no magenta. Save each original
as `art/raw/later/bg-<palette>.png`, then resize to `client/public/ui/bg-<palette>.png` with
the same command as above and a size of `(512, 512)`. Send the prompt once per row of the
table, filling in the three colours.

| Palette   | Used during                | Base      | Lighter   | Motif colour |
| --------- | -------------------------- | --------- | --------- | ------------ |
| `home`    | home screen                | `#1A1A2E` | `#2D2B55` | `#FFD23F`    |
| `lobby`   | lobby                      | `#2D1B69` | `#3F2A8C` | `#C6FF3D`    |
| `writing` | round intro, writing       | `#5B2A86` | `#6F3AA0` | `#FF8C42`    |
| `voting`  | voting, final voting       | `#0B7A75` | `#0F948E` | `#FF5DA2`    |
| `results` | matchup reveal, scoreboard | `#FFD23F` | `#FFDF70` | `#1B2A63`    |
| `podium`  | podium                     | `#1B2A63` | `#25377F` | `#FFD23F`    |

```
Single image: a seamless tileable background pattern for the game Say Less. This is a
finished image: ignore the magenta background rule for this image only; do not add
magenta.

Square 1024x1024, tiles seamlessly on all four edges. Base colour <BASE>, with a scattered
pattern of small simple faceted shapes in <LIGHTER> and a few in <MOTIF>: word tiles,
speech bubbles, microphones, pencils, sparkles, all well spaced. Very low contrast: the
pattern must stay quiet so white and dark text on top of it reads easily. Painted low-poly
look, matte, no outlines, no text, no characters.
```

**Confetti sheet** for the mic-drop overlay and the podium. Save as
`art/raw/later/confetti.png`. The tool does not cut this one yet (it gets a `SHEETS` entry
when it is wired), so it can sit there until then.

```
Sheet: confetti pieces, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the pieces.

Style: the attached Reel Town painted low-poly look: small chunky faceted pieces, gentle
shading lit from the upper left, matte, no outlines, no shadows.

Layout: square 2048x2048 canvas, 4 columns x 2 rows, one piece per cell, centred, filling
about 50% of the cell, wide empty magenta gaps between them.
Row 1, left to right: a yellow #FFD23F curled paper streamer, an orange #FF6B35 square
confetti flake tilted, a lime #C6FF3D star, a teal #0B7A75 circle flake.
Row 2, left to right: a cream #FFFAF0 zigzag streamer, a navy #1A1A2E triangle flake, a
gold four-point sparkle, a tiny yellow word tile tumbling.
No text.
```

---

## 4. Sounds

Nothing to generate: every sound is synthesized at runtime in `client/src/audio/sfx.ts`.

---

## 5. After generating

1. **Save** each image to the exact path under its prompt. File names are lowercase and
   must match exactly (`art/raw/characters/hedgehog.png`, `art/raw/sheets/icons.png`,
   ...). Everything under `art/raw/` is gitignored.
2. **Check the cut first**, without writing anything:

   ```bash
   uv run tools/dechroma.py --dry-run
   ```

   Sheets are still cut in memory, and each cell prints as
   `art/raw/characters/cat.png [writing] -> client/public/sprites/cat/writing.webp`. Look for
   a warning like:

   ```
   warning: art/raw/characters/cat.png: found 6 cells (rows of [3, 3]), expected 5 (rows of [3, 2]); cutting an even 3x2 grid instead
   ```

   It means two items touch (too few cells), or something stray sits in the gaps, such as a
   label, a sweat drop drawn far from its character, or a speck (too many cells). The even
   split usually still lands each item in its own file when ChatGPT kept to the grid, but
   open those files to check. If they are wrong, ask ChatGPT for the sheet again with
   "wider gaps between cells, nothing detached far from its character".

3. **Convert:**

   ```bash
   uv run tools/dechroma.py
   ```

   It writes `client/public/sprites/<id>/<pose>.webp`, `client/public/ui/<name>.webp`
   (512 x 512; `--size 768` for bigger) and rewrites both the sprite and UI manifests.
   About a second per 2048 px sheet.

4. **Look at the output** (open a few of the WebP files on a dark and a light background):
   - Edges do not glow pink. If they do, raise `soft_hi` in `key_out_magenta` in
     `tools/dechroma.py` (default 170) and run again.
   - The keyer now protects coral, grey and dusty lavender before applying its distance threshold.
     Check for see-through patches inside the art, especially the pale pink axolotl, its coral
     gills and lavender top, the cat's and rabbit's inner ears, the rabbit's cheeks, the
     fish's mouth, and any medium grey. If an area went see-through, lower `soft_hi` (try
     110), or ask ChatGPT to make that colour warmer (more peach, less pink) or darker.
   - Every file holds the item its name says (the right pose, the right icon). The sweat
     drop is in `writing` and `waiting`, the falling mic in `win`.
   - The five poses of one character are at the same scale and stand on the same baseline.
     The tool scales them together and aligns their feet, so a pose that looks tiny means
     another pose in the sheet is oversized (usually a mic drawn far away).
5. **See them in the game:** `npm run dev`, open http://localhost:5173, create a room. The
   lobby grid shows every character in `idle`, and your pick in `win`. The other poses show
   during a game (open three windows: one normal and two private).
6. **Commit** the generated files: everything new under `client/public/sprites/`
   (including `manifest.json`), everything new under `client/public/ui/`, and the three final
   files `client/public/icon-512.png`, `client/public/apple-touch-icon.png` and
   `client/public/og-image.png`. Do not commit anything under `art/raw/`; it is gitignored.

### Redoing one cell

When a single pose or icon is off, redo just that item instead of the whole sheet. In the
same chat, send:

```
Redo only the <ITEM> from the <SHEET NAME> sheet as a single image: the same design,
colours and proportions as in the sheet, one item centred on a square 2048x2048 canvas.
Background: a perfectly flat, uniform, pure magenta #FF00FF filling the whole canvas edge
to edge. No magenta, hot pink or fuchsia anywhere in the art. No other items, no text
(except text that is part of the item), no labels.
```

Save it in the single-file form. A single file replaces only that one cell; the rest still
come from the sheet:

| Redoing                 | Save as                              | Example                             |
| ----------------------- | ------------------------------------ | ----------------------------------- |
| one character pose      | `art/raw/characters/<id>/<pose>.png` | `art/raw/characters/otter/lose.png` |
| one UI cell or the logo | `art/raw/ui/<name>.png`              | `art/raw/ui/sound-off.png`          |

Then run `uv run tools/dechroma.py` again. The run prints
`... [lose] skipped: a single file replaces this cell` for the replaced cell. A replaced
character pose is fitted to the box and baseline of the pose it replaces in the sheet, so
it keeps the same scale as its siblings; both are measured by their opaque pixels, so a
faint half-keyed haze in an edited image does not shrink the character. A single UI image
is trimmed and scaled on its own. Podium stands must stay the same scale as each other, so
redo the whole podium sheet rather than one stand.
