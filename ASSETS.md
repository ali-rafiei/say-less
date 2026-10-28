# Art asset requests

The art set is generated and wired: the Cryptids (18 characters, 90 poses), 17 UI images,
two app icons and a share card. This document keeps the generation prompts, source paths,
grid orders and output sizes. The generation record is summarised under "Art provenance" in
the README; the sources stay local in `art/`, which is gitignored.

How it works:

1. Open a fresh ChatGPT chat, attach the logo (`art/raw/ui/logo.png`) and a phase background
   (`art/raw/backgrounds/02-lobby-deep-purple.png`), and paste the style block (section 1).
   Wait for ChatGPT to confirm.
2. Generate the two cast lineups (section 2) and stop to check them: they lock the designs,
   and every later prompt attaches them.
3. Paste one prompt at a time. Each prompt is self-contained and repeats the rules, because
   ChatGPT drifts between images. Save each result to the path given under its prompt.
4. Run `uv run tools/dechroma.py`. It keys out the magenta, cuts each sheet into its cells,
   trims, squares, resizes to 512 x 512 and writes WebP files the game loads (about a fifth
   of the PNG size, which matters on a phone's data plan).

What the game uses today:

- **Character sprites.** `client/src/components/Character.tsx` shows
  `client/public/sprites/<id>/<pose>.webp` for every character in `shared/src/characters.ts`.
  There are no drawn fallbacks: `client/test/Character.test.tsx` fails if a character is
  missing a pose.
- **UI images.** Icons, podium stands, how-to illustrations and the logo use `UIArt.tsx` and
  the generated `client/public/ui/manifest.json` bounds; `UIArtName` is typed from that
  manifest, so a missing image fails the typecheck. The tags (Great Minds, Backfire!,
  Robbed, Crowd Favourite, Random answer) are game text, not images. App icons and the share
  card are linked from `client/index.html`. The logo fade and pose animations are CSS.

## Progress

The Cryptid set took 25 generations: 2 lineups, 18 character sheets, 3 UI sheets, one
redone how-to cell and the share card. The logo, app icons and phase backgrounds are kept
from the first art set (section 6).

| Done | Save ChatGPT's image as                    | What                             | Grid, cells | The tool writes                                | Wired |
| ---- | ------------------------------------------ | -------------------------------- | ----------- | ---------------------------------------------- | ----- |
| [x]  | `art/reference/cryptid-lineup.png`         | Cast lineup, first 12            | reference   | (not processed; attached to prompts)           | n/a   |
| [x]  | `art/reference/cryptid-lineup-2.png`       | Cast lineup, last 6              | reference   | (not processed; attached to prompts)           | n/a   |
| [x]  | `art/raw/characters/bigfoot.png`           | Bigfoot, 5 poses                 | 3x2, 5      | `client/public/sprites/bigfoot/<pose>.webp`    | yes   |
| [x]  | `art/raw/characters/yeti.png`              | Yeti, 5 poses                    | 3x2, 5      | `client/public/sprites/yeti/<pose>.webp`       | yes   |
| [x]  | `art/raw/characters/nessie.png`            | Nessie, 5 poses                  | 3x2, 5      | `client/public/sprites/nessie/<pose>.webp`     | yes   |
| [x]  | `art/raw/characters/mothman.png`           | Mothman, 5 poses                 | 3x2, 5      | `client/public/sprites/mothman/<pose>.webp`    | yes   |
| [x]  | `art/raw/characters/jackalope.png`         | Jackalope, 5 poses               | 3x2, 5      | `client/public/sprites/jackalope/<pose>.webp`  | yes   |
| [x]  | `art/raw/characters/kraken.png`            | Kraken, 5 poses                  | 3x2, 5      | `client/public/sprites/kraken/<pose>.webp`     | yes   |
| [x]  | `art/raw/characters/kappa.png`             | Kappa, 5 poses                   | 3x2, 5      | `client/public/sprites/kappa/<pose>.webp`      | yes   |
| [x]  | `art/raw/characters/alien.png`             | Alien, 5 poses                   | 3x2, 5      | `client/public/sprites/alien/<pose>.webp`      | yes   |
| [x]  | `art/raw/characters/ghost.png`             | Ghost, 5 poses                   | 3x2, 5      | `client/public/sprites/ghost/<pose>.webp`      | yes   |
| [x]  | `art/raw/characters/chupacabra.png`        | Chupacabra, 5 poses              | 3x2, 5      | `client/public/sprites/chupacabra/<pose>.webp` | yes   |
| [x]  | `art/raw/characters/flatwoods.png`         | Flatwoods, 5 poses               | 3x2, 5      | `client/public/sprites/flatwoods/<pose>.webp`  | yes   |
| [x]  | `art/raw/characters/werewolf.png`          | Werewolf, 5 poses                | 3x2, 5      | `client/public/sprites/werewolf/<pose>.webp`   | yes   |
| [x]  | `art/raw/characters/vampire.png`           | Vampire, 5 poses                 | 3x2, 5      | `client/public/sprites/vampire/<pose>.webp`    | yes   |
| [x]  | `art/raw/characters/skeleton.png`          | Skeleton, 5 poses                | 3x2, 5      | `client/public/sprites/skeleton/<pose>.webp`   | yes   |
| [x]  | `art/raw/characters/phoenix.png`           | Phoenix, 5 poses                 | 3x2, 5      | `client/public/sprites/phoenix/<pose>.webp`    | yes   |
| [x]  | `art/raw/characters/unicorn.png`           | Unicorn, 5 poses                 | 3x2, 5      | `client/public/sprites/unicorn/<pose>.webp`    | yes   |
| [x]  | `art/raw/characters/gargoyle.png`          | Gargoyle, 5 poses                | 3x2, 5      | `client/public/sprites/gargoyle/<pose>.webp`   | yes   |
| [x]  | `art/raw/characters/cerberus.png`          | Cerberus, 5 poses                | 3x2, 5      | `client/public/sprites/cerberus/<pose>.webp`   | yes   |
| [x]  | `art/raw/sheets/icons.png`                 | Icons (flame, crown, sound, ...) | 4x2, 7      | `client/public/ui/<icon>.webp`                 | yes   |
| [x]  | `art/raw/sheets/podium.png`                | Podium stands 1, 2, 3            | 3x1, 3      | `client/public/ui/stand-<n>.webp`              | yes   |
| [x]  | `art/raw/sheets/howto.png`                 | How-to-play illustrations        | 3x2, 6      | `client/public/ui/howto-<step>.webp`           | yes   |
| [x]  | `art/raw/ui/howto-vote.png`                | How-to "vote", redone            | single      | `client/public/ui/howto-vote.webp`             | yes   |
| [x]  | `art/raw/ui/logo.png`                      | SAY LESS wordmark (kept)         | single      | `client/public/ui/logo.webp`                   | yes   |
| [x]  | `client/public/icon-512.png`               | App icon, 512 x 512 (kept)       | final file  | (not processed by the tool)                    | yes   |
| [x]  | `client/public/apple-touch-icon.png`       | iOS home-screen icon (kept)      | final file  | (not processed by the tool)                    | yes   |
| [x]  | `client/public/og-image.png`               | Link-preview card, 1200 x 630    | final file  | (not processed by the tool)                    | yes   |
| [x]  | `art/raw/backgrounds/<nn>-<palette>-*.png` | Phase backgrounds (kept)         | single, 6   | `client/public/backgrounds/<palette>.webp`     | yes   |

For the final files, save ChatGPT's original under `art/raw/final/` and resize it into place
with the commands in section 6.2.

---

## The cast at a glance

| Cryptid    | Colour             | Signature                      | Temperament                              |
| ---------- | ------------------ | ------------------------------ | ---------------------------------------- |
| Bigfoot    | tan `#E0A870`      | small round sunglasses         | cool, camera-shy celebrity               |
| Yeti       | cream `#FFFAF0`    | long yellow scarf              | warm and cosy, gives the best hugs       |
| Nessie     | teal `#2BB3A3`     | long S-curved neck             | playful poser, loves a photo             |
| Mothman    | cobalt `#4F6BED`   | a little table lamp            | gentle, dreamy, devoted to lamps         |
| Jackalope  | yellow `#FFD23F`   | antlers, teal bandana          | hyper, fast, proud of its antlers        |
| Kraken     | red `#FF3D68`      | stolen captain's hat           | confident multitasker                    |
| Kappa      | green `#3DDC84`    | water dish on its head         | polite and careful, never spills a drop  |
| Alien      | lime `#C6FF3D`     | tourist camera                 | wide-eyed, delighted by everything       |
| Ghost      | sky `#7CC6F2`      | bedsheet with a wavy hem       | giggly prankster                         |
| Chupacabra | coral `#FF8A65`    | spines that rise with its mood | small, fearless, all bark no bite        |
| Flatwoods  | orange `#FF6B35`   | tall spade-shaped hood         | grand, theatrical, loves an entrance     |
| Werewolf   | lavender `#B8A9F5` | howl, bushy tail               | big fluffy softie, howls along to it all |
| Vampire    | crimson `#C42B3C`  | high-collared cape             | dramatic, old-fashioned charmer          |
| Skeleton   | bone `#EDE6D3`     | red bow tie                    | cheerful, rattly show-off dancer         |
| Phoenix    | amber `#FFB020`    | flame crest; loses as ash      | unstoppable optimist                     |
| Unicorn    | violet `#8E6CEF`   | gold spiral horn               | sweet, wholesome, easily scandalised     |
| Gargoyle   | slate `#6B80AC`    | stone wings, statue stillness  | loyal, watchful guardian                 |
| Cerberus   | rust `#7A3B2E`     | three heads, spiked collars    | three moods that never agree             |

Pairs play off each other: Bigfoot hides from cameras while Nessie poses for them, the
Alien is the tourist with the camera, and the Werewolf and Vampire are the classic rivals.
With 18, some colours sit close together; the shapes keep them apart. These are the
colours the prompts ask for. The painted colours drifted (Mothman came out a brighter blue,
Kraken an orange-red), so the accents in `shared/src/characters.ts`, used for name chips and
vote bars, are measured from the cut sprites instead.

## What to reject (the "AI look")

Send it back if you see any of these, by saying exactly what is wrong (for example "remove
the white sparkles in the eyes and the pink cheeks, keep everything else"):

- sparkly or glossy eyes, eyelashes, blush or rosy cheeks
- soft gradients, airbrushed shading, glow, shiny plastic highlights, a 3D-render look
- an outline that changes thickness or disappears in places
- extra small details (stitches, freckles, textures, fur strands, stray sparkles, motion
  lines)
- a stiff, symmetrical pose with arms hanging straight down, or two characters standing
  or emoting the same way
- a character that no longer matches the lineup (shape, colour, face, signature item)
- anything scary: menacing eyes, extra teeth or claws, a snarl
- magenta or hot pink anywhere in the art (watch the werewolf's and jackalope's ears)

---

## 1. Style block (first message, with the logo and lobby background attached)

```
You are producing 2D game art for "Say Less", a party game played on phones. The two
attached images are this game's existing art and set the look: the "SAY LESS" logo and a
phase background. Match their rendering exactly: chunky solid shapes built from a few large
flat facets, hard two-tone shading per colour (one lit tone, one shade tone) as if lit from
the upper left, matte, and the logo's thick navy #1A1A2E edge. Use the attachments for the
look only, not for layout: no backgrounds, no scenery, no purple shapes, no text.

The cast is "the Cryptids": eighteen legendary creatures (Bigfoot, Nessie, Mothman and
friends) drawn as lovable cartoon characters, never scary. Each is a distinct individual
with its own temperament. Players each pick one to be for the whole game, so every
character must be one people want to be: charming, funny and likeable.

Rendering, the same for every character:
- Body: big flat facets in two tones of its body colour, with its thickness showing as a
  navy side edge along the lower right, exactly like the logo letters. Fur is a few big
  faceted tufts, never strands.
- Outline: one thick, even navy #1A1A2E outline around the whole silhouette, the same
  weight on every character.
- Flat and graphic: no gradients, no airbrushing, no glow, no glossy highlights, no
  sparkles, no texture or noise, no soft or ground shadows, no 3D-render or plastic-toy
  look. Big shapes that still read at 26 pixels.

Personality, different for every character (I describe each one):
- Face: each character has its own face design: its own eye shape and size, brows, nose
  or beak, mouth and teeth as I describe them. Eyes are flat shapes (solid navy ovals,
  cream whites with a solid navy pupil, or a colour I name) with simple flat lids where a
  pose needs them. Never white sparkle highlights, eyelashes or detailed irises. No blush,
  no rosy cheeks.
- Anatomy: each character has its own body plan, hands and feet (paws, claws, flippers,
  tentacles) in its own colours. Hands are chunky simple shapes with at most three blunt
  fingers or claws, never detailed human hands. No clothes; only the one signature item I
  name.
- Acting: expressions and poses are specific and asymmetric: a raised brow, a lean, a
  slouch, weight on one leg, a head tilt. Never a stiff symmetrical stance with arms
  hanging straight down. No two characters stand or emote the same way.

Palette (characters use their own colours; everything else uses these):
ink navy #1A1A2E, paper cream #FFFAF0, yellow #FFD23F, orange #FF6B35, lime #C6FF3D,
teal #0B7A75, red #FF3D68 (a warm tomato red), green #3DDC84, gold #FFD23F,
silver #DFE3EE, bronze #E0A870.

Background rule for every image unless I say otherwise: a perfectly flat, uniform, pure
magenta #FF00FF background filling the entire canvas edge to edge. No gradient, no
vignette, no texture, no floor, no scenery. A script keys the magenta out, so never use
magenta, hot pink, fuchsia or purple-pink in the art itself.

Sheets: I give a grid and a cell order. Place items left to right, top to bottom, one per
cell, all at the same scale. Leave wide empty magenta gaps between cells (at least a tenth
of the canvas width) and never let an item touch or cross into a neighbouring cell. Keep
small detached parts (a sweat drop, a splash) close to their own item. No text, speech
bubbles or sound words unless I give the exact text.

Output a square image at 2048x2048 or larger unless I say otherwise. Confirm you
understand, then wait.
```

---

## 2. Cast lineup (reference sheet; check it before going on)

Save as `art/reference/cryptid-lineup.png`

```
Sheet: the full cast lineup of "the Cryptids", for the game Say Less. This sheet is the
model reference for every later image, so make each design clear and simple, and make
each character's personality obvious from its face and stance alone.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the characters.

Style: exactly the style block: faceted two-tone matte bodies with a navy side edge like
the logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle
highlights, each character's own face and anatomy. No gradients, no glow, no blush, no
sparkles, no text. Lovable, never scary.

Layout: square 2048x2048 canvas, 4 columns x 3 rows, one character per cell, each in its
own signature idle pose given below, feet on the same baseline in each row, each filling
about 65% of its cell. Heights may differ a little to suit each body (Bigfoot tallest,
Kappa and Chupacabra smallest). Wide empty magenta gaps, nothing touching. No names, no
labels.

Row 1, left to right:
1. Bigfoot: a tall, lanky ape-like creature in shaggy tan #E0A870 fur (big faceted
   tufts), with a lighter tan face, palms and soles, long arms reaching its knees,
   enormous flat feet and a slight forward slouch. Face: heavy brow ridge with thick tan
   brows, small round navy sunglasses, a wide flat nose, an easy-going grin. A cool,
   camera-shy celebrity. Pose: caught mid-stride in its famous walk, glancing back over
   its shoulder, one long arm swinging.
2. Yeti: a round, shaggy snowball of a creature in fluffy cream #FFFAF0 fur (light grey
   #E6E1D6 shade facets), with a sky blue #7CC6F2 face, palms and feet, and two short
   curved cream horns. Face: small wide-set solid navy oval eyes, a wide smile with two
   small blunt cream teeth pointing up from its lower lip. Wears a long yellow #FFD23F
   scarf wrapped once around its neck, both ends hanging. Warm and cosy. Pose: arms
   thrown open wide offering a hug, head tilted, beaming.
3. Nessie: the Loch Ness Monster as a plump plesiosaur: round body with three small humps
   along its back, a long curving neck, a small round head and a short tail, standing
   upright on its two back flippers and using its front flippers as arms. Teal #2BB3A3
   with a cream #FFFAF0 belly. Face: big round cream eyes with solid navy pupils, two
   small round nubs on its head, a coy closed-mouth smile. A playful poser. Pose: posing
   for a photo, neck curved into a graceful S, head tilted coyly, one flipper on its hip.
4. Mothman: a fuzzy moth creature on two thin legs: a round cobalt blue #4F6BED body, a
   big fluffy cream #FFFAF0 ruff around its neck, two feathery antennae, and large darker
   cobalt wings folded around its shoulders like a cape. Face: two huge round solid red
   #FF3D68 eyes with no pupils, a small navy mouth. Gentle and dreamy, devoted to lamps.
   Pose: hugging a small table lamp (cream base, yellow #FFD23F shade) lovingly to its
   chest, eyes half-closed in bliss under flat cobalt lids, antennae curled happily.
Row 2, left to right:
5. Jackalope: a jackrabbit with a small pair of tan #E0A870 deer antlers between its long
   ears. Golden yellow #FFD23F fur with a cream #FFFAF0 belly and cream insides to its
   ears, big long feet. Face: big round cream eyes with solid navy pupils, a small navy
   nose, two big cream buck teeth. A teal #0B7A75 bandana tied around its neck. Hyper and
   proud. Pose: weight on one foot, the other big foot tapping, chest puffed out, one paw
   proudly polishing an antler.
6. Kraken: a chubby octopus with a big round domed head-body and eight short thick
   tentacles; it stands on four and uses four as arms. Red #FF3D68, a warm tomato red,
   with cream #FFFAF0 tentacle undersides. Face: wide eyes with cream whites, solid navy
   pupils and heavy relaxed half-lids, a big confident grin. A small navy captain's hat
   with a cream band at a jaunty angle, clearly taken from a ship. A confident
   multitasker. Pose: leaning back, two tentacles crossed, a third tipping its hat.
7. Kappa: a small Japanese water imp: short round green #3DDC84 body, a tan #E0A870 turtle
   shell on its back, a yellow #FFD23F duck-like beak, webbed hands and feet, and on top
   of its head a round cream #FFFAF0 dish holding sky blue #7CC6F2 water, ringed by a
   short fringe of teal #0B7A75 hair. Face: round cream eyes with solid navy pupils.
   Polite and careful. Pose: a small polite bow from the waist, webbed hands together,
   eyes up, keeping the dish perfectly level.
8. Alien: a little green visitor from space: lime #C6FF3D skin, a big upside-down-pear
   head on a small slender body, two thin antennae with round bobbles on top,
   three-fingered hands. Face: two huge solid navy almond-shaped eyes, a tiny mouth.
   Carries a small silver #DFE3EE camera. A wide-eyed tourist. Pose: holding the camera
   up in one hand and waving hello with the other, head tilted with curiosity.
Row 3, left to right:
9. Ghost: a classic bedsheet ghost: a rounded dome head flowing into a sheet with a wavy
   hem, sky blue #7CC6F2, two stubby sheet arms, no legs; the hem floats just above the
   baseline. Face: two tall solid navy oval eyes, a cheeky grin. A giggly prankster. Pose:
   leaning forward with both arms raised as if sneaking up to say boo, tongue poking out
   cheekily.
10. Chupacabra: a small, scrappy lizard-dog standing on two legs: coral #FF8A65 body (an
    orange-leaning coral, never pink), a row of big orange #FF6B35 spines from its head
    down its back, big pointed ears, a long thin tail, clawed paws. Face: huge round cream
    eyes with solid navy pupils, a wide grin with one small cream fang poking out. Small
    but fearless. Pose: up on tiptoe to look bigger, chest out, fists up like a tiny
    boxer, spines bristling, grinning.
11. Flatwoods: the Flatwoods Monster: a small round cream #FFFAF0 face in front of a tall
    orange #FF6B35 hood shaped like a spade symbol (point at the top) rising high behind
    its head, a flared bell-shaped orange gown for a body with two tiny navy feet peeking
    out below, and two small orange arms ending in three blunt claws. Face: two big round
    solid navy eyes, a small round mouth. A grand, theatrical performer. Pose: a grand
    flourish, chin up, one tiny claw raised high, the other on its chest.
12. Werewolf: a big, shaggy wolf creature standing on two legs, in lavender #B8A9F5 fur
    (a blue-leaning lavender-grey, never pink) drawn as big faceted tufts, with a fluffy
    cream #FFFAF0 chest ruff and muzzle, big pointed ears with cream insides, a huge
    bushy tail, and paws with three blunt claws. Face: round cream eyes with solid navy
    pupils under shaggy brows, a big round navy nose, a goofy open-mouthed grin. A big
    fluffy softie who howls along to everything. Pose: head thrown back mid-howl with its
    eyes closed, one paw pressed to its chest, tail held high.

The creatures are the only things in the image besides their named items. No text.
```

**Check before going on:** every character distinct at a glance, each with its signature
item and its own stance, same outline weight, no sparkles in the eyes, no pink, nothing
scary. If one is off, ask for that one cell to be redrawn and keep the rest.

---

## 2b. Second lineup (six more; attach the first lineup)

Save as `art/reference/cryptid-lineup-2.png`

```
Sheet: the second cast lineup of "the Cryptids", six more characters for the game Say
Less. Match the attached first lineup exactly: the same rendering, outline weight, eye
style and proportions, so these six could stand in that lineup. This sheet is the model
reference for these six, so make each design clear and simple, and make each character's
personality obvious from its face and stance alone.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the characters.

Style: exactly the style block: faceted two-tone matte bodies with a navy side edge like
the logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle
highlights, each character's own face and anatomy. No gradients, no glow, no blush, no
sparkles, no text. Lovable, never scary.

Layout: square 2048x2048 canvas, 3 columns x 2 rows, one character per cell, each in its
own signature idle pose given below, feet on the same baseline in each row, each filling
about 60% of its cell. Wide empty magenta gaps, nothing touching. No names, no labels.

Row 1, left to right:
1. Vampire: a small, charming cartoon vampire with pale silver #DFE3EE skin,
   slicked-back navy hair with a pointed widow's peak, and small pointed ears. It is
   wrapped in a big high-collared cape, deep crimson #C42B3C outside (a dark red, never
   pink) with a navy lining, that hides its body; only its small pale hands and small
   navy shoes show. Face: round cream eyes with solid navy pupils, arched navy brows, a
   charming grin showing two small cream fangs. A dramatic, old-fashioned charmer. Pose:
   one arm sweeping its cape up across its face to just below its eyes, brows arched,
   eyes smiling over the collar.
2. Skeleton: a cheerful cartoon skeleton built from a few chunky rounded bones, not
   realistic anatomy: a big round skull, a simple ribcage of three thick curved ribs, a
   chunky spine, chunky bone arms and legs, and round bone hands with three blunt
   fingers. Bone #EDE6D3 with light grey #CFC8B6 shade facets. Face: two big round solid
   navy eyes, a small navy triangle nose, a wide grin with a row of square cream teeth.
   A small red #FF3D68 bow tie at its neck. A cheerful, rattly show-off who loves to
   dance. Pose: mid-dance, one leg kicked out to the side, arms swinging, skull tilted,
   grinning.
3. Phoenix: a plump firebird standing on two legs: amber #FFB020 feathers drawn as big
   faceted plumes, a cream #FFFAF0 chest, a crest of three big flame-shaped feathers on
   its head in orange #FF6B35 with red #FF3D68 tips, a long tail of flame-shaped feathers
   in the same colours, wings it uses as arms with feather-tip fingers, a short yellow
   #FFD23F beak and small navy feet. The flames are flat feather shapes. Face: big round
   cream eyes with solid navy pupils, navy brows, a confident beak grin. An unstoppable
   optimist. Pose: wing-hands on its hips, chest puffed out, crest standing tall,
   confident grin.
Row 2, left to right:
4. Unicorn: a small, round unicorn standing upright on its two hind hooves and using its
   front hooves as hands: a violet #8E6CEF coat drawn as big facets, a long gold #FFD23F
   spiral horn, a flowing cream #FFFAF0 mane and tail drawn as a few big chunky locks,
   violet insides to its ears, a cream muzzle and cream hooves. Face: big round cream eyes with solid navy pupils, small
   navy nostrils, a sweet smile. A sweet, wholesome soul who is easily scandalised. Pose:
   standing daintily with one front hoof raised, head held high, eyes closed in a serene
   little smile.
5. Gargoyle: a stocky little stone gargoyle: slate blue-grey #6B80AC stone drawn as big
   flat chunky facets, two short curved horns, pointed ears, folded stone bat wings, a
   short tail, clawed hands and feet. Face: small solid navy eyes under a heavy stone
   brow, a wide flat grin with square cream teeth. A loyal, watchful guardian. Pose:
   crouched on its haunches like a gargoyle on a rooftop, chin resting on its fists,
   wings folded, watching with a knowing grin.
6. Cerberus: the three-headed guardian of the underworld from Greek myth, as a big,
   imposing but friendly beast: hulking and broad-chested, standing upright on thick
   hind legs, using its huge front paws as hands (three blunt claws each). Dark
   rust-brown #7A3B2E fur drawn as big faceted tufts, with a shaggy mane of bigger,
   darker tufts around all three necks. Three heads side by side on its broad
   shoulders, each with pointed ears, a heavy brow, a broad muzzle, two small cream
   fangs poking up from its lower jaw, and amber #FFB020 eyes with solid navy pupils.
   Each head wears its own silver #DFE3EE collar with a few big blunt spikes. A short
   thick tail. Three heads, three moods, and they never agree. Pose: a big exasperated
   shrug, both huge paws out to the sides with palms up; the left head grinning at the
   viewer, the middle head scowling sideways at the left head, the right head asleep
   against the middle head.

The creatures are the only things in the image besides their named items. No text.
```

**Check before going on:** the same checks as the first lineup, and the six look like they
belong next to the first twelve.

---

## 3. Character sheets (18)

Attach `art/reference/cryptid-lineup.png` with every character prompt from 3.1 to 3.12,
and `art/reference/cryptid-lineup-2.png` with every prompt from 3.13 to 3.18. The game layout
for each sheet: 3 columns x 2 rows; row 1 `idle`, `writing`, `waiting`; row 2 `win`,
`lose`, empty. These are stills: the game animates them itself (breathing, scribbling,
bouncing, deflating). The win pose is always arms up.

Each prompt below is complete; the character paragraph and all five poses are written for
that character.

### 3.1 Bigfoot

Save as `art/raw/characters/bigfoot.png`

```
Sheet: Bigfoot character poses, for the game Say Less. Keep Bigfoot exactly on-model with
the attached lineup (row 1, first character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Bigfoot, a tall, lanky ape-like creature in shaggy tan #E0A870 fur (big
faceted tufts), with a lighter tan face, palms and soles, long arms reaching its knees,
enormous flat feet and a slight forward slouch. Face: heavy brow ridge with thick tan
brows, small round navy sunglasses, a wide flat nose, an easy-going grin. Personality: a
cool, laid-back, camera-shy celebrity who wants to be left alone but secretly loves the
attention.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: caught mid-stride in its famous walk, glancing back over its shoulder at the
   viewer, one long arm swinging, both feet on the baseline.
2. writing: hunched over a tiny cream notepad held in one huge hand, writing with a short
   yellow pencil stub (grey metal band, cream eraser), shielding the page with its other
   arm so nobody can copy; one small pale-blue sweat drop beside its head.
3. waiting: pulling its sunglasses down its nose with one finger to peek sideways over
   them with small navy eyes, worried brows; one small pale-blue sweat drop beside its
   head.
4. win: sunglasses pushed up onto its head, small navy eyes squeezed shut with joy, both
   long arms thrown up high, a huge open grin.
5. lose: slouched over deeply, long arms dragging, sunglasses crooked, sad brows,
   noticeably shorter.

Props: only the sunglasses, pencil, notepad and sweat drop named above, each close to the
character. No other objects, no motion lines, no stars, no confetti.
```

### 3.2 Yeti

Save as `art/raw/characters/yeti.png`

```
Sheet: Yeti character poses, for the game Say Less. Keep Yeti exactly on-model with the
attached lineup (row 1, second character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Yeti, a round, shaggy snowball of a creature in fluffy cream #FFFAF0 fur (big
faceted tufts, light grey #E6E1D6 shade facets), with a sky blue #7CC6F2 face, palms and
feet, and two short curved cream horns. Short sturdy legs, big round fluffy arms. Face:
small wide-set solid navy oval eyes, a wide smile with two small blunt cream teeth
pointing up from its lower lip. Signature item: a long yellow #FFD23F scarf wrapped once
around its neck, both ends hanging. Personality: warm, cosy and cheerful; loves snow and
gives the best hugs.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: arms thrown open wide offering a hug, head tilted, beaming.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser) and
   writing on a small cream notepad held in the other hand, tongue poking out in
   concentration, one scarf end flopped onto the page; one small pale-blue sweat drop
   beside its head.
3. waiting: nervously nibbling one end of its scarf, eyes glancing sideways; one small
   pale-blue sweat drop beside its head.
4. win: both arms thrown up high, scarf ends flung out, eyes closed in happy arcs, a big
   open smile.
5. lose: fur drooping flat as if it is melting, shoulders sagging, scarf slipping down,
   sad eyes, noticeably shorter.

Props: only the scarf, pencil, notepad and sweat drop named above, each close to the
character. No other objects, no snowflakes, no motion lines, no stars, no confetti.
```

### 3.3 Nessie

Save as `art/raw/characters/nessie.png`

```
Sheet: Nessie character poses, for the game Say Less. Keep Nessie exactly on-model with
the attached lineup (row 1, third character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Nessie, the Loch Ness Monster as a plump plesiosaur: round body with three
small humps along its back, a long curving neck, a small round head and a short tail,
standing upright on its two back flippers and using its two front flippers as arms. Teal
#2BB3A3 with a cream #FFFAF0 belly. Face: big round cream eyes with solid navy pupils, two
small round nubs on its head, a coy closed-mouth smile. Personality: a playful poser who
loves having its photo taken and strikes a pose for every camera.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, back flippers on the same
baseline height in every cell, the character filling about 70% of the cell height. Wide
empty magenta gaps; nothing touches or crosses into a neighbouring cell. No water, no
labels, no panels, no borders.

Poses:
1. idle: posing for a photo, neck curved into a graceful S, head tilted coyly, one
   flipper on its hip.
2. writing: neck curled down so its head is right next to a small cream notepad held in
   one flipper, writing with a short yellow pencil stub (grey metal band, cream eraser)
   held in the other, concentrating; one small pale-blue sweat drop beside its head.
3. waiting: neck stretched out sideways as if peeking round a corner, eyes wide, a small
   worried mouth; one small pale-blue sweat drop beside its head.
4. win: neck stretched straight up tall and proud, both front flippers thrown up high, a
   big open-mouthed smile.
5. lose: neck drooping all the way down so its head hangs near its flippers like a wilted
   flower, sad eyes, noticeably shorter.

Props: only the pencil, notepad and sweat drop named above, each close to the character.
No other objects, no motion lines, no stars, no confetti.
```

### 3.4 Mothman

Save as `art/raw/characters/mothman.png`

```
Sheet: Mothman character poses, for the game Say Less. Keep Mothman exactly on-model with
the attached lineup (row 1, fourth character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Mothman, a fuzzy moth creature on two thin legs: a round cobalt blue #4F6BED
body, a big fluffy cream #FFFAF0 ruff around its neck, two feathery antennae, and large
darker cobalt wings folded around its shoulders like a cape. Face: two huge round solid
red #FF3D68 eyes with no pupils and no highlights, a small navy mouth; it shows its mood
with flat cobalt lids over the red eyes and with its antennae. Signature item: a small
table lamp with a cream base and a yellow #FFD23F shade, unlit. Personality: a gentle,
dreamy night owl, completely devoted to lamps.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: hugging its little lamp lovingly to its chest, eyes half-closed in bliss under
   flat lids, antennae curled happily.
2. writing: wings wrapped forward around itself like a hood over a small cream notepad,
   writing with a short yellow pencil stub (grey metal band, cream eraser), eyes narrowed
   in focus; one small pale-blue sweat drop beside its head. No lamp.
3. waiting: wings clutched tight around its body, antennae bent with worry, lids slanted
   anxiously over its red eyes; one small pale-blue sweat drop beside its head. No lamp.
4. win: wings spread wide open behind it, both arms thrown up high, antennae straight up,
   mouth wide open with joy. No lamp.
5. lose: wings drooping around it like a soaked cloak, antennae limp, sad heavy lids,
   noticeably shorter. No lamp.

Props: only the lamp in the idle pose, and the pencil, notepad and sweat drop named above,
each close to the character. No light rays, no other objects, no motion lines, no stars,
no confetti.
```

### 3.5 Jackalope

Save as `art/raw/characters/jackalope.png`

```
Sheet: Jackalope character poses, for the game Say Less. Keep Jackalope exactly on-model
with the attached lineup (row 2, first character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Jackalope, a jackrabbit with a small pair of tan #E0A870 deer antlers between
its long ears. Golden yellow #FFD23F fur with a cream #FFFAF0 belly and cream insides to
its ears (never pink), big long feet. Face: big round cream eyes with solid navy pupils, a
small navy nose, two big cream buck teeth. Signature item: a teal #0B7A75 bandana tied
around its neck. Personality: hyper, fast and confident; can't stand still and is very
proud of its antlers.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: weight on one foot, the other big foot tapping, chest puffed out, one paw
   proudly polishing an antler.
2. writing: leaning in and scribbling super fast with a short yellow pencil stub (grey
   metal band, cream eraser) on a small cream notepad held in the other paw, ears
   standing straight up; one small pale-blue sweat drop beside its head.
3. waiting: arms crossed, one big foot thumping impatiently, eyes glancing sideways; one
   small pale-blue sweat drop beside its head.
4. win: springing up on its toes with its feet still on the baseline, both arms thrown up
   high, ears straight up, a big buck-toothed grin.
5. lose: both ears flopped down over its face, shoulders slumped, antlers tilted, sad
   eyes peeking out, noticeably shorter.

Props: only the bandana, pencil, notepad and sweat drop named above, each close to the
character. No other objects, no motion lines, no stars, no confetti.
```

### 3.6 Kraken

Save as `art/raw/characters/kraken.png`

```
Sheet: Kraken character poses, for the game Say Less. Keep Kraken exactly on-model with
the attached lineup (row 2, second character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Kraken, a chubby octopus with a big round domed head-body and eight short thick
tentacles; it stands on four and uses the other four as arms. Red #FF3D68, a warm tomato
red, never pink, with cream #FFFAF0 tentacle undersides. Face: wide eyes with cream
whites, solid navy pupils and heavy relaxed half-lids, a big confident grin. Signature
item: a small navy captain's hat with a cream band, worn at a jaunty angle, clearly taken
from a ship. Personality: a confident, busy multitasker who does five things at once.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, standing tentacles on the same
baseline height in every cell, the character filling about 70% of the cell height. Wide
empty magenta gaps; nothing touches or crosses into a neighbouring cell. No water, no
labels, no panels, no borders.

Poses:
1. idle: leaning back confidently, two tentacles crossed, a third tipping its hat.
2. writing: holding a small cream notepad in one tentacle and scribbling on it with three
   short yellow pencil stubs (grey metal band, cream eraser) at once, one in each of
   three other tentacles; one small pale-blue sweat drop beside its head.
3. waiting: arm tentacles twisted together nervously, hat pulled down low, eyes glancing
   sideways; one small pale-blue sweat drop beside its head.
4. win: all four arm tentacles thrown up high, hat tipped back, a huge grin.
5. lose: melted into a low heap of drooping tentacles, hat slipped down over one eye, sad
   half-lidded eyes, noticeably shorter.

Props: only the hat, pencils, notepad and sweat drop named above, each close to the
character. No other objects, no motion lines, no stars, no confetti.
```

### 3.7 Kappa

Save as `art/raw/characters/kappa.png`

```
Sheet: Kappa character poses, for the game Say Less. Keep Kappa exactly on-model with the
attached lineup (row 2, third character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Kappa, a small Japanese water imp: a short round green #3DDC84 body, a tan
#E0A870 turtle shell on its back, a yellow #FFD23F duck-like beak, webbed hands and feet,
and on top of its head a round cream #FFFAF0 dish holding sky blue #7CC6F2 water, ringed
by a short fringe of teal #0B7A75 hair. Face: round cream eyes with solid navy pupils.
Signature item: the water dish on its head, which it must never spill. Personality: very
polite, careful and earnest; bows to everyone, very carefully.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: a small polite bow from the waist, webbed hands together, eyes up, keeping the
   dish perfectly level.
2. writing: standing perfectly straight, writing very neatly with a short yellow pencil
   stub (grey metal band, cream eraser) on a small cream notepad held in the other hand,
   eyes glancing up at its dish; one small pale-blue sweat drop beside its head.
3. waiting: frozen stiff with both arms out to the sides for balance, eyes rolled up
   toward its dish; one small pale-blue sweat drop beside its head.
4. win: both arms thrown up high, eyes squeezed shut with joy, beak wide open, its head
   still perfectly level and not a drop spilled.
5. lose: head tipped to one side with a few sky-blue drops of water spilling from its
   dish, close beside its head, shoulders sagging, sad eyes, noticeably shorter.

Props: only the dish, pencil, notepad, sweat drop and spilled drops named above, each
close to the character. No other objects, no motion lines, no stars, no confetti.
```

### 3.8 Alien

Save as `art/raw/characters/alien.png`

```
Sheet: Alien character poses, for the game Say Less. Keep Alien exactly on-model with the
attached lineup (row 2, fourth character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Alien, a little green visitor from space: lime #C6FF3D skin, a big
upside-down-pear head on a small slender body, two thin antennae with round bobbles on
top, three-fingered hands. Face: two huge solid navy almond-shaped eyes with no
highlights, a tiny mouth; it shows its mood with flat lime lids over the eyes and with its
antennae. Signature item: a small silver #DFE3EE camera. Personality: a wide-eyed tourist,
curious about and delighted by everything on Earth.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No spaceship, no labels, no
panels, no borders.

Poses:
1. idle: holding the camera up in one hand and waving hello with the other, head tilted
   with curiosity.
2. writing: hunched over a small cream notepad, writing with a short yellow pencil stub
   (grey metal band, cream eraser), antennae bobbles leaning toward the page in
   fascination; one small pale-blue sweat drop beside its head. No camera.
3. waiting: antennae bent with worry, lids lowered halfway over its big eyes, glancing
   sideways; one small pale-blue sweat drop beside its head. No camera.
4. win: holding the camera up high at arm's length to take a selfie, the other arm thrown
   up high, tiny mouth wide open with joy.
5. lose: antennae drooping, big head hanging forward, lids half-closed and sad,
   noticeably shorter. No camera.

Props: only the camera in the idle and win poses, and the pencil, notepad and sweat drop
named above, each close to the character. No other objects, no motion lines, no stars, no
confetti.
```

### 3.9 Ghost

Save as `art/raw/characters/ghost.png`

```
Sheet: Ghost character poses, for the game Say Less. Keep Ghost exactly on-model with the
attached lineup (row 3, first character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no transparency, no blush, no sparkles, no text, no ground shadow.
Lovable, never scary.

Character: Ghost, a classic bedsheet ghost: a rounded dome head flowing into a sheet with
a wavy hem, sky blue #7CC6F2, fully opaque, two stubby sheet arms, no legs. Face: two tall
solid navy oval eyes and a cheeky grin. Personality: a giggly, playful prankster who
loves sneaking up behind people.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, the bottom of the wavy hem at the
same baseline height in every cell, the character filling about 70% of the cell height.
Wide empty magenta gaps; nothing touches or crosses into a neighbouring cell. No labels,
no panels, no borders.

Poses:
1. idle: leaning forward with both arms raised as if sneaking up to say boo, tongue
   poking out cheekily. No speech bubble, no text.
2. writing: hovering over a small cream notepad, writing with a short yellow pencil stub
   (grey metal band, cream eraser) held in one sheet arm, eyes narrowed in concentration;
   one small pale-blue sweat drop beside its head.
3. waiting: half-hiding behind a corner of its own sheet pulled up over its mouth, eyes
   peeking sideways; one small pale-blue sweat drop beside its head.
4. win: twirling with its hem flared out, both arms thrown up high, laughing.
5. lose: collapsed into a flat puddle of sheet on the baseline with only its sad eyes
   peeking out of the top, much shorter.

Props: only the pencil, notepad and sweat drop named above, each close to the character.
No chains, no other objects, no motion lines, no stars, no confetti.
```

### 3.10 Chupacabra

Save as `art/raw/characters/chupacabra.png`

```
Sheet: Chupacabra character poses, for the game Say Less. Keep Chupacabra exactly
on-model with the attached lineup (row 3, second character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Chupacabra, a small, scrappy lizard-dog standing on two legs: a coral #FF8A65
body (an orange-leaning coral, never pink), a row of big orange #FF6B35 spines from its
head down its back, big pointed ears, a long thin tail, clawed paws. Face: huge round
cream eyes with solid navy pupils, a wide grin with one small cream fang poking out. Its
spines show its mood: standing up when it is excited, lying flat when it is sad.
Personality: small but fearless, spunky and full of energy, all bark and no bite.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: up on tiptoe to look bigger, chest out, fists up like a tiny boxer, spines
   bristling, grinning.
2. writing: crouched over a small cream notepad, writing with a short yellow pencil stub
   (grey metal band, cream eraser), tongue poking out, tail curled, spines half-raised;
   one small pale-blue sweat drop beside its head.
3. waiting: ears pinned back, spines half-raised, biting its lip with its fang, eyes
   darting sideways; one small pale-blue sweat drop beside its head.
4. win: spines standing fully up like a crown, both arms thrown up high, mouth wide open
   in a joyful howl.
5. lose: spines lying flat, ears drooping, tail limp, sad eyes, noticeably shorter.

Props: only the pencil, notepad and sweat drop named above, each close to the character.
No other objects, no motion lines, no stars, no confetti.
```

### 3.11 Flatwoods

Save as `art/raw/characters/flatwoods.png`

```
Sheet: Flatwoods character poses, for the game Say Less. Keep Flatwoods exactly on-model
with the attached lineup (row 3, third character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Flatwoods, the Flatwoods Monster: a small round cream #FFFAF0 face in front of
a tall orange #FF6B35 hood shaped like a spade symbol (point at the top) rising high
behind its head, a flared bell-shaped orange gown for a body with two tiny navy feet
peeking out below, and two small orange arms ending in three blunt claws. Face: two big
round solid navy eyes, a small round mouth. Its hood shows its mood: fanned out when it
is happy, folded in when it is nervous. Personality: a grand, theatrical performer who
loves making an entrance.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: a grand flourish, chin up, one tiny claw raised high, the other on its chest,
   hood fanned out.
2. writing: writing with a theatrical flourish, chin up, holding a short yellow pencil
   stub (grey metal band, cream eraser) delicately in one tiny claw over a small cream
   notepad held in the other; one small pale-blue sweat drop beside its head.
3. waiting: hood folded in around its face like a shy flower, eyes peeking sideways; one
   small pale-blue sweat drop beside its head.
4. win: hood fanned out wide and proud, both tiny claws thrown up high, mouth open in a
   delighted gasp.
5. lose: hood wilting forward over its face like a closing flower, gown sagging, sad eyes
   peeking out, noticeably shorter.

Props: only the pencil, notepad and sweat drop named above, each close to the character.
No other objects, no motion lines, no stars, no confetti.
```

### 3.12 Werewolf

Save as `art/raw/characters/werewolf.png`

```
Sheet: Werewolf character poses, for the game Say Less. Keep Werewolf exactly on-model
with the attached lineup (row 3, fourth character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Werewolf, a big, shaggy wolf creature standing on two legs, in lavender
#B8A9F5 fur (a blue-leaning lavender-grey, never pink) drawn as big faceted tufts, with a
fluffy cream #FFFAF0 chest ruff and muzzle, big pointed ears with cream insides, a huge
bushy tail, and paws with three blunt claws. Face: round cream eyes with solid navy pupils
under shaggy brows, a big round navy nose, a goofy open-mouthed grin. Its ears and tail
show its mood. Personality: a big fluffy softie who gets carried away and howls along to
everything.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: head thrown back mid-howl with its eyes closed, one paw pressed to its chest,
   tail held high.
2. writing: hunched over a small cream notepad, writing with a short yellow pencil stub
   (grey metal band, cream eraser), tongue poking out, ears pricked forward, tail
   wagging; one small pale-blue sweat drop beside its head.
3. waiting: ears flattened, tail wrapped around its legs, nibbling one claw, eyes
   glancing sideways; one small pale-blue sweat drop beside its head.
4. win: both arms thrown up high, howling with joy, tail wagging high.
5. lose: ears drooping, tail limp along the baseline, shoulders slumped, big sad eyes,
   noticeably shorter.

Props: only the pencil, notepad and sweat drop named above, each close to the character.
No other objects, no motion lines, no stars, no confetti.
```

### 3.13 Vampire

Save as `art/raw/characters/vampire.png`

```
Sheet: Vampire character poses, for the game Say Less. Keep Vampire exactly on-model with
the attached second lineup (row 1, first character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Vampire, a small, charming cartoon vampire with pale silver #DFE3EE skin,
slicked-back navy hair with a pointed widow's peak, and small pointed ears. It is wrapped
in a big high-collared cape, deep crimson #C42B3C outside (a dark red, never pink) with a
navy lining, that hides its body; only its small pale hands and small navy shoes show.
Face: round cream eyes with solid navy pupils, arched navy brows, a charming grin showing
two small cream fangs. Signature item: the cape, which shows its mood. Personality: a
dramatic, old-fashioned charmer who sweeps its cape across its face at every surprise.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: one arm sweeping its cape up across its face to just below its eyes, brows
   arched, eyes smiling over the collar.
2. writing: cape thrown back over its shoulders, writing with a theatrical flourish with
   a short yellow pencil stub (grey metal band, cream eraser) on a small cream notepad
   held in the other hand; one small pale-blue sweat drop beside its head.
3. waiting: cape pulled up to hide everything below its eyes, eyes darting sideways; one
   small pale-blue sweat drop beside its head.
4. win: cape flung wide open behind it showing the navy lining, both arms thrown up high,
   a big grin showing its two small fangs.
5. lose: cape drooping around it like a collapsed tent, collar flopped down, sad eyes,
   noticeably shorter.

Props: only the cape, pencil, notepad and sweat drop named above, each close to the
character. No other objects, no motion lines, no stars, no confetti.
```

### 3.14 Skeleton

Save as `art/raw/characters/skeleton.png`

```
Sheet: Skeleton character poses, for the game Say Less. Keep Skeleton exactly on-model
with the attached second lineup (row 1, second character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Skeleton, a cheerful cartoon skeleton built from a few chunky rounded bones,
not realistic anatomy: a big round skull, a simple ribcage of three thick curved ribs, a
chunky spine, chunky bone arms and legs, and round bone hands with three blunt fingers.
Bone #EDE6D3 with light grey #CFC8B6 shade facets. Face: two big round solid navy eyes, a
small navy triangle nose, a wide grin with a row of square cream teeth. Signature item: a
small red #FF3D68 bow tie at its neck. Personality: a cheerful, rattly show-off who
loves to dance and doesn't mind falling to pieces.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: mid-dance, one leg kicked out to the side, arms swinging, skull tilted,
   grinning.
2. writing: hunched over a small cream notepad, writing with a short yellow pencil stub
   (grey metal band, cream eraser), its jaw hanging open in concentration; one small
   pale-blue sweat drop beside its skull.
3. waiting: knees knocking together, teeth chattering, eyes glancing sideways; one small
   pale-blue sweat drop beside its skull.
4. win: both arms thrown up high, one knee raised in a dance with the other foot on the
   baseline, skull tipped back laughing.
5. lose: collapsed into a neat little pile of bones on the baseline with its skull
   resting on top, sad eyes, bow tie askew, much shorter.

Props: only the bow tie, pencil, notepad and sweat drop named above, each close to the
character. No other objects, no motion lines, no stars, no confetti.
```

### 3.15 Phoenix

Save as `art/raw/characters/phoenix.png`

```
Sheet: Phoenix character poses, for the game Say Less. Keep Phoenix exactly on-model with
the attached second lineup (row 1, third character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Phoenix, a plump firebird standing on two legs: amber #FFB020 feathers drawn
as big faceted plumes, a cream #FFFAF0 chest, a crest of three big flame-shaped feathers
on its head in orange #FF6B35 with red #FF3D68 tips, a long tail of flame-shaped feathers
in the same colours, wings it uses as arms with feather-tip fingers, a short yellow
#FFD23F beak and small navy feet. The flames are flat feather shapes. Face: big round
cream eyes with solid navy pupils, navy brows, a confident beak grin. Its crest shows its
mood. Personality: an unstoppable optimist; nothing keeps it down for long.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: wing-hands on its hips, chest puffed out, crest standing tall, confident grin.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser) in its
   feather-tip fingers and writing on a small cream notepad, crest bent forward over the
   page in concentration; one small pale-blue sweat drop beside its head.
3. waiting: crest flattened, nervously preening one tail feather with its beak, eyes
   glancing sideways; one small pale-blue sweat drop beside its head.
4. win: wings spread wide and up, crest and tail fanned out tall, beak wide open in a
   joyful cry.
5. lose: slumped into a small heap of grey #A3A6B0 ash on the baseline, with only its sad
   eyes, beak and one drooping crest feather poking out of the top, much shorter.

Props: only the pencil, notepad, sweat drop and ash heap named above, each close to the
character. No other objects, no motion lines, no stars, no confetti.
```

### 3.16 Unicorn

Save as `art/raw/characters/unicorn.png`

```
Sheet: Unicorn character poses, for the game Say Less. Keep Unicorn exactly on-model with
the attached second lineup (row 2, first character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Unicorn, a small, round unicorn standing upright on its two hind hooves and
using its front hooves as hands: a violet #8E6CEF coat drawn as big facets, a long gold
#FFD23F spiral horn, a flowing cream #FFFAF0 mane and tail drawn as a few big chunky
locks, violet insides to its ears, a cream muzzle and cream hooves. Face: big round cream eyes with solid navy pupils,
small navy nostrils, a sweet smile. Its mane shows its mood. Personality: a sweet,
wholesome soul who is easily scandalised.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, hind hooves on the same baseline
height in every cell, the character filling about 70% of the cell height. Wide empty
magenta gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels,
no borders.

Poses:
1. idle: standing daintily with one front hoof raised, head held high, eyes closed in a
   serene little smile.
2. writing: holding a short yellow pencil stub (grey metal band, cream eraser) in one
   front hoof and writing very carefully on a small cream notepad held in the other,
   tongue poking out, mane falling over one eye; one small pale-blue sweat drop beside
   its head.
3. waiting: one front hoof pressed to its mouth in a scandalised gasp, eyes wide and
   glancing sideways; one small pale-blue sweat drop beside its head.
4. win: rearing up happily with both front hooves thrown up high and its hind hooves on
   the baseline, mane and tail flung out, a big open smile.
5. lose: mane drooping over its face, horn tilted, shoulders slumped, sad eyes,
   noticeably shorter.

Props: only the pencil, notepad and sweat drop named above, each close to the character.
No other objects, no motion lines, no stars, no confetti.
```

### 3.17 Gargoyle

Save as `art/raw/characters/gargoyle.png`

```
Sheet: Gargoyle character poses, for the game Say Less. Keep Gargoyle exactly on-model
with the attached second lineup (row 2, second character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Gargoyle, a stocky little stone gargoyle: slate blue-grey #6B80AC stone drawn
as big flat chunky facets, two short curved horns, pointed ears, folded stone bat wings, a
short tail, clawed hands and feet. Face: small solid navy eyes under a heavy stone brow, a
wide flat grin with square cream teeth. Personality: a loyal, watchful guardian that can
sit so still people mistake it for a statue.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No rooftop, no pedestal, no
labels, no panels, no borders.

Poses:
1. idle: crouched on its haunches like a gargoyle on a rooftop, chin resting on its
   fists, wings folded, watching with a knowing grin.
2. writing: hunched over a small cream notepad, writing carefully with a short yellow
   pencil stub (grey metal band, cream eraser), tongue poking out, wings half open for
   balance; one small pale-blue sweat drop beside its head.
3. waiting: frozen perfectly still as if pretending to be a statue, only its eyes sliding
   sideways; one small pale-blue sweat drop beside its head.
4. win: stone wings spread wide, both arms thrown up high, its grin wide open.
5. lose: slumped with its head in its hands, wings drooping heavily, noticeably shorter.

Props: only the pencil, notepad and sweat drop named above, each close to the character.
No other objects, no motion lines, no stars, no confetti.
```

### 3.18 Cerberus

Save as `art/raw/characters/cerberus.png`

```
Sheet: Cerberus character poses, for the game Say Less. Keep Cerberus exactly on-model
with the attached second lineup (row 2, third character).

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the character or props.

Style: exactly the style block: faceted two-tone matte body with a navy side edge like the
logo letters, one thick even navy #1A1A2E outline, flat eyes with no sparkle highlights.
No gradients, no glow, no blush, no sparkles, no text, no ground shadow. Lovable, never
scary.

Character: Cerberus, the three-headed guardian of the underworld from Greek myth, as a
big, imposing but friendly beast: hulking and broad-chested, standing upright on thick
hind legs, using its huge front paws as hands (three blunt claws each). Dark rust-brown
#7A3B2E fur drawn as big faceted tufts, with a shaggy mane of bigger, darker tufts around
all three necks. Three heads side by side on its broad shoulders, each with pointed ears,
a heavy brow, a broad muzzle, two small cream fangs poking up from its lower jaw, and
amber #FFB020 eyes with solid navy pupils. Each head wears its own silver #DFE3EE collar
with a few big blunt spikes. A short thick tail. Each head has its own mood: the left head cheerful, the middle head
grumpy, the right head sleepy. Personality: three heads, three moods, and they never
agree; it looks fearsome and acts like a big lovable lump.

Layout: square 2048x2048 canvas, 3 columns x 2 rows. Row 1, left to right: idle, writing,
waiting. Row 2, left to right: win, lose, then an empty bottom-right cell. One full-body
pose per cell. All five poses at exactly the same scale, feet on the same baseline height
in every cell, the character filling about 70% of the cell height. Wide empty magenta
gaps; nothing touches or crosses into a neighbouring cell. No labels, no panels, no
borders.

Poses:
1. idle: a big exasperated shrug, both huge paws out to the sides with palms up; the left
   head grinning at the viewer, the middle head scowling sideways at the left head, the
   right head asleep against the middle head.
2. writing: holding a small cream notepad in one huge paw and writing with a short yellow
   pencil stub (grey metal band, cream eraser), the middle head concentrating on the
   page while the left head peers over eagerly and the right head dozes; one small
   pale-blue sweat drop beside the middle head.
3. waiting: paws clasped, the three heads looking nervously in three different
   directions; one small pale-blue sweat drop beside the middle head.
4. win: both huge paws thrown up high, all three heads roaring with joy together, eyes
   squeezed shut, tail up.
5. lose: slumped, all three heads drooping with ears flat and sad eyes, tail limp,
   noticeably shorter.

Props: only the collars, pencil, notepad and sweat drop named above, each close to the
character. No other objects, no motion lines, no stars, no confetti.
```

---

## 4. UI sheets

### 4.1 Icons (4x2)

Save as `art/raw/sheets/icons.png`

Icons show as small as 20 px (the leader crown) on both dark backgrounds and cream cards,
so each needs one strong silhouette.

```
Sheet: UI icons, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the icons.

Style: exactly the style block applied to objects: each icon one chunky object built from a
few large flat facets in two tones with a navy side edge along the lower right, like the
attached logo letters, and one thick even navy #1A1A2E outline. No gradients, no glow, no
texture, no drop shadows. Readable at 20 pixels: big shapes, no small details.

Layout: square 2048x2048 canvas, 4 columns x 2 rows. Each icon centred in its cell,
filling about 65% of it, front or three-quarter view, all at the same visual scale, wide
empty magenta gaps, nothing touching.
Row 1, left to right:
1. flame: a stylised roast flame, orange #FF6B35 outside, yellow #FFD23F core, three
   licking tongues, no pink or red-pink.
2. crown: a chunky gold #FFD23F crown with three rounded points and a cream #FFFAF0 band.
3. sound-on: a chunky navy speaker with a cream cone, and two curved yellow #FFD23F sound
   waves beside it, touching or nearly touching the speaker.
4. sound-off: the same speaker with the waves replaced by a red #FF3D68 X right beside the
   cone.
Row 2, left to right:
5. pencil: a short yellow #FFD23F pencil stub, sharpened tan wooden tip, grey metal band
   and a cream eraser (no pink eraser), angled for writing.
6. tile: one word tile seen from the front, slightly taller than wide (about 4:5), built
   exactly like a single letter block of the logo: a yellow #FFD23F faceted face with a
   thick navy side edge. Blank, no letter.
7. seat: an empty seat for a player who has not joined: a light grey #C9CCD6 rounded speech
   bubble whose navy outline is drawn as short dashes, with a big chunky slate grey
   #5A5F6B "?" in its middle.
8. empty: nothing in this cell.

The only text allowed is the "?" in the seat. No other text, no extra items.
```

### 4.2 Podium (3x1)

Save as `art/raw/sheets/podium.png`

The game places them 2-1-3 with the winners standing on top and writes each score on the
stand's front band.

```
Sheet: podium stands, for the game Say Less.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the stands.

Style: exactly the style block applied to blocks: each stand a chunky slab whose front is
built from a few large flat facets in two tones, with a thick navy side edge along the
right showing its depth, like the attached logo letters, and one thick even navy #1A1A2E
outline. No gradients, no glow, no texture, no drop shadows.

Layout: landscape canvas 2048 wide, 3 columns x 1 row, left to right: first place, second
place, third place. Front view, straight on, no perspective. All three exactly the same
width and at the same scale, their bottom edges on one shared baseline, wide empty magenta
gaps between them, nothing touching.
1. first place: gold #FFD23F stand, about three quarters as tall as it is wide, a big
   chunky navy #1A1A2E numeral "1" on the front.
2. second place: silver #DFE3EE stand, about half as tall as it is wide, a big chunky navy
   numeral "2" on the front.
3. third place: bronze #E0A870 stand, about two fifths as tall as it is wide, a big chunky
   navy numeral "3" on the front.
Each stand has slightly rounded top corners, a flat top for characters to stand on, and a
plain flat band across the front below the numeral where the game writes the score. The
numerals are built like the logo letters, chunky rounded bold with their own navy edge.
No characters, no steps, no stars, no other text.
```

### 4.3 How-to pictures (3x2; attach the lineup)

Save as `art/raw/sheets/howto.png`

```
Sheet: how-to-play illustrations, for the game Say Less. Use the cast from the attached
lineup and keep every character exactly on-model, with its own face, anatomy and
signature item.

Background: a perfectly flat, uniform, pure magenta #FF00FF background filling the whole
canvas edge to edge. No magenta, hot pink or fuchsia anywhere in the illustrations.

Style: exactly the style block: faceted two-tone matte bodies with a navy side edge, one
thick even navy #1A1A2E outline on characters and props, flat eyes with no sparkle
highlights. No gradients, no glow, no blush, no sparkles, no ground shadows. Props use the
game palette: navy #1A1A2E, cream #FFFAF0, yellow #FFD23F, orange #FF6B35, lime #C6FF3D,
teal #0B7A75.

Layout: square 2048x2048 canvas, 3 columns x 2 rows, one illustration per cell, each a
compact vignette filling about 70% of its cell. Within a vignette the characters and props
overlap or touch so it reads as one cluster, with nothing floating loose. Keep each
vignette simple: at most three characters. Wide empty magenta gaps between cells, nothing
crossing into a neighbouring cell, no scenery, no frames.
Row 1, left to right:
1. gather: Bigfoot, Yeti and Kappa huddled together, each holding a phone, around a cream
   card showing the room code "KZPW".
2. answer: Jackalope scribbling fast on a small notepad with a yellow pencil, a row of six
   yellow word tiles floating just above it with the last three tiles cracking and
   falling away.
3. vote: two cream answer cards side by side labelled "A" and "B", Alien and Ghost in
   front of them, each pointing at a different card.
Row 2, left to right:
4. bigger rounds: three chunky yellow #FFD23F word tiles built like the logo letters,
   growing left to right (small, medium, large), showing "x1", "x2" and "x3" in navy, with
   Kraken standing beside the largest one, all four arm tentacles thrown up, ecstatic.
5. roast: Chupacabra holding up an orange roast flame toward Mothman, whose row of word
   tiles above its head is burning down to just two tiles; Mothman gazes at the flame,
   enchanted.
6. final: a small three-step podium, gold in the middle, silver left, bronze right, with
   Nessie on gold, Werewolf on silver and Flatwoods on bronze.

The only text allowed is "KZPW", "A", "B", "x1", "x2" and "x3". No other text, no
captions.
```

The vote cell was redone on its own as a portrait image and saved as
`art/raw/ui/howto-vote.png`; a single file replaces its sheet cell (see "Redoing one cell").

---

## 5. Share card (finished file; attach the logo and the lineup)

Save as `art/raw/final/og.png`. Same layout as the current card, new cast.

```
Single image: the link-preview card for the game Say Less, shown when the game's link is
shared in a chat. This is a finished image: ignore the magenta background rule for this
image only, and use no magenta or hot pink anywhere.

Style: exactly the style block: faceted two-tone shapes with navy side edges and thick even
navy #1A1A2E outlines, matte, no gradients except the background glow, no sparkles.

Composition: landscape 1536x1024. It will be cropped to 1200x630 from the centre, so keep
everything important inside the central band 1536 wide by 806 tall. Background: navy
#1A1A2E with a soft lighter glow of #2D2B55 at the top centre. Left half: the attached
SAY LESS logo exactly as it is, "SAY" huge in yellow with a navy edge and hard drop shadow,
"LESS" beneath it in cream with wide letter spacing, and under that the tagline in cream
rounded bold letters: "Everyone's got something to say. You've got fewer words to say it."
Right half: four cast members from the attached lineup, Bigfoot, Nessie, Mothman and
Kraken, standing together as a compact group, each with its own face and signature item,
Bigfoot in the middle with both long arms thrown up in celebration. Spell the text exactly
as given. No other text.
```

---

## 6. Kept from the first art set

These were made for the first cast with an earlier style block (painted low-poly, no
outlines) and still fit the game, so they were not redone. Their prompts are kept as they
were used.

### 6.1 Logo (single image)

Save as `art/raw/ui/logo.png`

The home screen shows this image through `UIArt` (`.logo__art` in
`client/src/styles/art.css`): "SAY" huge and yellow with a navy edge and a hard navy drop
shadow, "LESS" beneath it, smaller, cream, with wide letter spacing. The game fades the
bottom of LESS out with a CSS mask, as if the word is cut off mid-sentence, so paint LESS
**solid**: a fade painted into the magenta keys out as a grey-pink smear.

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

### 6.2 Final files: app icons and share card (no magenta, not processed)

These three are finished files with solid backgrounds; the share card's prompt is in
section 5. They skip the tool: save ChatGPT's
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

### 6.3 Phase backgrounds

**Phase backgrounds** are done: six abstract paintings, one per palette (`home`, `lobby`,
`writing`, `voting`, `results`, `podium`), portrait 1024 x 1536 and full-bleed, so no
magenta. To replace one, save it as `art/raw/backgrounds/<nn>-<palette>-<anything>.png` and
run the tool; it converts without keying. Keep the top quarter and the centre plain: the
header, the prompt and the cards sit there.

---

## 7. Wanted, not made yet

Neither is wired; each needs a `SHEETS` entry in `tools/dechroma.py` and a place in the
game before it is worth generating. Use the style block and attach the lineups.

- **Game-mode pictures** (`art/raw/sheets/modes.png`, 2x2: `mode-classic`, `mode-custom`,
  `mode-doodle`, `mode-context`): one small vignette per mode card in the lobby and per mode
  line in How to play, until then text cards. For example, a cryptid reading a cream prompt
  card under a row of yellow word tiles (classic), one writing on a stack of blank cards
  (custom), one drawing a wobbly face on a big phone screen (doodle), and one holding up a
  card with a big question mark while another looks puzzled (out of context).
- **Confetti** (4x2 small pieces in the game palette: streamers, flakes, a star, a tumbling
  word tile) for the podium.

---

## 8. Sounds

Nothing to generate: every sound is synthesized at runtime in `client/src/audio/sfx.ts`.

---

## 9. After generating

1. **Save** each image to the exact path under its prompt. File names are lowercase and
   must match exactly (`art/raw/characters/chupacabra.png`, `art/raw/sheets/icons.png`,
   ...). Everything under `art/raw/` is gitignored. A new character also needs its id in
   `CHARACTER_IDS` in `tools/dechroma.py` and an entry in `shared/src/characters.ts`.
2. **Check the cut first**, without writing anything:

   ```bash
   uv run tools/dechroma.py --dry-run
   ```

   Sheets are still cut in memory, and each cell prints as
   `art/raw/characters/kraken.png [writing] -> client/public/sprites/kraken/writing.webp`.
   The cutter gives each separate piece of art to the grid cell its centre falls in, so
   poses may sit close, and a wide pose may reach over its neighbour's space, as long as
   they do not touch. Look for a warning like:

   ```
   warning: art/raw/characters/kraken.png: no separate art for win; cutting an even 3x2 grid instead
   ```

   It means two items touch, so they came out as one piece. The even split may still land
   each item in its own file, but open those files to check. If they are wrong, ask
   ChatGPT for the sheet again with "wider gaps between cells, nothing touching".

3. **Convert:**

   ```bash
   uv run tools/dechroma.py
   ```

   It writes `client/public/sprites/<id>/<pose>.webp`, `client/public/ui/<name>.webp`
   (512 x 512; `--size 768` for bigger) and rewrites the UI manifest. Cutting is quick;
   WebP encoding at its smallest setting takes about three seconds per image, so the whole
   set takes about six minutes. `uv run tools/dechroma.py --self-test` checks the cutter on
   synthetic sheets in a few seconds.

4. **Look at the output** (open a few of the WebP files on a dark and a light background):
   - Edges do not glow pink. If they do, raise `soft_hi` in `key_out_magenta` in
     `tools/dechroma.py` (default 170) and run again.
   - Nothing inside the art went see-through. The keyer only keys magenta-tinted patches
     that hold true key colour, so pink walled in by the outline (the Unicorn's inner ears)
     keeps its colour; pink that touches the background directly could still key.
   - Every file holds the item its name says (the right pose, the right icon), and wide
     poses (the Skeleton, Ghost and Kraken lying down in `lose`) come out whole.
   - The five poses of one character are at the same scale and stand on the same baseline.
     The tool scales them together to fit the tallest pose and aligns their feet; only a
     pose wider than that (a character lying down) is shrunk on its own. A standing pose
     that looks tiny means another pose in the sheet is oversized.
5. **See them in the game:** `npm run dev`, open http://localhost:5173, create a room. The
   lobby grid shows every character in `idle`, and your pick in `win`. The other poses show
   during a game (open three windows: one normal and two private).
6. **Commit** the generated files: everything new under `client/public/sprites/` and
   `client/public/ui/`, and any final file you replaced. Do not commit anything under
   `art/raw/`; it is gitignored.

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

| Redoing                 | Save as                              | Example                              |
| ----------------------- | ------------------------------------ | ------------------------------------ |
| one character pose      | `art/raw/characters/<id>/<pose>.png` | `art/raw/characters/kraken/lose.png` |
| one UI cell or the logo | `art/raw/ui/<name>.png`              | `art/raw/ui/sound-off.png`           |

Then run `uv run tools/dechroma.py` again. The run prints
`... [lose] skipped: a single file replaces this cell` for the replaced cell. A replaced
character pose is fitted to the box and baseline of the pose it replaces in the sheet, so
it keeps the same scale as its siblings; both are measured by their opaque pixels, so a
faint half-keyed haze in an edited image does not shrink the character. A single UI image
is trimmed and scaled on its own. Podium stands must stay the same scale as each other, so
redo the whole podium sheet rather than one stand.
