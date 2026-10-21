# Say Less

> Everyone's got something to say. You've got fewer words to say it.

Say Less is a fully online 2D party game for 3–12 players, inspired by Quiplash. Players
answer absurd prompts under a word limit that shrinks every round (12 → 6 → 3 words),
everyone votes on the funniest answer, and the shrinking budget is the joke engine. Every
player joins from their own phone; there is no shared TV screen.

This README is deliberately long. It is the context-preservation document for the
project: architecture, every rule as implemented, every deviation from the original
build spec, the deployment runbook, and where to pick up. If you are resuming work in a
fresh session, read this file first, then `ASSETS.md` if you are touching art.

- **Live game:** https://38dcd.yeg.rac.sh/ (IPv6-only, see [Hosting](#hosting-on-cybera)).
  Cybera published the AAAA record about 50 minutes after the instance was created; the
  bare address `http://[2605:fd00:4:1001:f816:3eff:fe02:e97f]/` also works over plain HTTP.
- **Repo:** https://github.com/ali-rafiei/say-less (public; contains no secrets)
- **Status:** v1 complete through milestone M6 of the spec; painted art (the Cryptids); see [Roadmap](#roadmap--known-gaps)

---

## Table of contents

1. [How a game plays](#how-a-game-plays)
2. [Architecture](#architecture)
3. [Repository layout](#repository-layout)
4. [Running locally](#running-locally)
5. [Tests and quality gates](#tests-and-quality-gates)
6. [Game rules as implemented](#game-rules-as-implemented)
7. [State machine and timers](#state-machine-and-timers)
8. [WebSocket protocol](#websocket-protocol)
9. [Redaction and anti-cheat](#redaction-and-anti-cheat)
10. [Reconnect and presence](#reconnect-and-presence)
11. [Client design](#client-design)
12. [Characters and art pipeline](#characters-and-art-pipeline)
13. [Prompt bank](#prompt-bank)
14. [Hosting on Cybera](#hosting-on-cybera)
15. [Deployment runbook](#deployment-runbook)
16. [Deviations from the build spec](#deviations-from-the-build-spec)
17. [Decisions log](#decisions-log)
18. [Roadmap / known gaps](#roadmap--known-gaps)
19. [Troubleshooting](#troubleshooting)

---

## How a game plays

1. One player creates a room and gets a 4-letter code (no O or I). Others join with the
   code or the invite link (`/?code=ABCD`). The creator is the **leader** and owns the
   Start button and settings: game mode, prompt packs, profanity filter, word limits,
   roasts, timer speed, game length, random answers, anonymous final, audience and seats (see
   [Room options](#room-options)). The five game modes:
   - **Classic**: prompts from the ticked packs.
   - **Custom**: anyone in the lobby adds prompts. They are dealt first, nobody gets a
     prompt they wrote, the packs fill any shortfall, and a leftover one becomes the final.
   - **Doodle**: each round opens with 75 s of drawing a secret suggestion with a finger.
     The drawings become the round's prompts: two other players caption each one, the
     artist stays anonymous until the reveal ("drawn by Cat").
   - **Out of Context** (after _Survive the Internet_): every round, including
     the final, opens with 45 s of answering an opinion question honestly in up to 8 words
     ("How do you feel about fidget cubes?" "Weirdly calming."). Each quote goes to one
     other player on a shuffled ring, who never sees the question. They get the quote as a
     post on a fake site (News, Social, Fundraiser, Check-in, Shop, Video, Forum, Jobs;
     `shared/src/sites.ts`) and write the headline, product, place or thread it was under,
     within the round's word limit. All posts go on one wall, the twisters hidden, and
     everyone gets one vote for the most ridiculous post, never the one they twisted. Each
     vote pays the twister 100 and the victim 20 pity points; the single most-voted post
     (at least 2 votes) is the **Best Burn**, +150 to its twister and +30 to its victim; all
     × the round multiplier. Each round ends with the one-by-one reveal below and the
     scoreboard. Roasts do not apply (there are no matchups) and the toggle is hidden.
   - **Initials**: prompts from the ticked packs, each dealt with letters (`shared/src/constants.ts`
     `INITIALS_LENGTHS`: 5, 4, then 3 in the final). An answer needs exactly one word per
     letter, each starting with its letter in order ("B T D": "Bring The Drill"); accents
     and leading punctuation are ignored. Both writers of a matchup get the same letters. A
     roast keeps only the first two letters. The word-limit toggle and random answers are hidden
     (the letters are the limit and the challenge).

   In Doodle the final replays the drawing that drew the most votes (the crowd favourite),
   captioned by everyone. A player who drew nothing in time leaves a slot that a pack prompt
   fills; an Out of Context player who wrote nothing is quoted as "No comment."

2. **Pick a character in the lobby**: eighteen characters, first tap locks it for everyone.
   Anyone who hasn't picked when the leader presses Start gets a random leftover.
3. **Round 1 "Say Some"** – 12 words, 120 s, ×1 points. Each player gets two prompts;
   each prompt is answered by exactly two players (ring pairing).
4. **Voting** per matchup (20 s): the two answers are shown anonymously; the players who
   did not write them vote. Then a 6 s **reveal**: characters slide in, vote bars fill,
   any tags (Great Minds, Backfire!, Robbed, Crowd Favourite, Random answer) pop in as text.
5. **Round 2 "Say Less"** – 6 words, 120 s, ×2. The first 10 s of the writing phase is
   the **roast window**: each player holds one roast token for the whole game and may
   spend it on one opponent, cutting that opponent's next answer to 2 words. If the
   roasted player wins the matchup anyway, they steal the roaster's points from it. Roasts
   are off by default; the leader switches them on in the lobby (`settings.roasts`).
   Without them round 2 has no window.
6. **Final round "Say Nothing… Almost"** – 3 words, 60 s, ×3. One shared
   prompt, everyone answers, everyone ranks their top two (not themselves).
7. **Final reveal**: after "The votes are in…", the final answers are spotlighted one at a
   time from fewest points to most. Each shows the answer first, then its author, tally
   and points a beat later. Every answer gets the same 2.5 s, the best answer lands last
   with a crown and 2 s more, and there is no countdown on screen. Revealed answers stack up
   below the spotlight. Final points are added to scores only at the podium, so the
   reveal gives nothing away early.
8. **Podium**: the top three blocks rise third, second, then first; the winner cheers and
   second and third stand proud (no losing pose on the podium). Under them, **Final
   scores** (everyone's total, in order), the superlatives ticker,
   "Best of the game" (each round's most-voted answer), then the last question's answers
   with the points that question alone gave, and Rematch (leader) or Leave. A rematch keeps the room and excludes prompts already used; waiting
   audience members take any free seats first.

### Room options

All lobby settings belong to the leader. Defaults in `Room.settings` (`server/src/room.ts`).

| Option          | Values (default first) | Effect                                                                                                                                                                                                                                   |
| --------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timers          | Normal, Relaxed, Off   | Relaxed doubles every writing, drawing and voting clock (`TIMERS.RELAXED_FACTOR`). Off removes them: the phase waits for everyone, and the leader gets **Move on**, which closes it (stragglers auto-submit). Reveals keep their timing. |
| Game length     | Full, Short            | Short goes from round 1 straight to the final (no round 2, so no roasts).                                                                                                                                                                |
| Random answers  | On, Off                | A stuck writer taps **Stuck? Send a random answer** twice and the server files a stock answer from `content/bailouts.json` that fits the limit. Half vote points, labelled "Random answer" at the reveal. Hidden in Initials.            |
| Anonymous final | Off, On                | The final wall hides authors until the reveal; votes use opaque per-final ids. Hidden in Out of Context (posts are anonymous already).                                                                                                   |
| Audience        | On, Off                | Anyone joining a game in progress or a full room watches and votes instead of being turned away (up to `LIMITS.MAX_AUDIENCE`, 50). Off restores the old refusal.                                                                         |
| Seats           | 3 to 12 (12)           | Players before the rest join the audience. Lowering it never unseats anyone.                                                                                                                                                             |

**In game**, the leader has a row under the header with **Pause** (freezes every clock for
everyone; nothing can be submitted until **Resume**, and a disconnect cannot end the phase
meanwhile) and, with timers off, **Move on**. In the lobby the leader can
**remove** a player (✕ on their chip); mid-game the removed player's seat stays for the
matchups but their phone is shut out.

---

## Architecture

```
 phone A ──┐                          ┌─ Room "ABCD" (state machine, timers)
 phone B ──┼── WSS /ws ── Gateway ────┼─ Room "QXZT"
 phone C ──┘        (socket↔player)   └─ ...
                          │
                    RoomManager (create / lookup / expire)
                          │
                    PromptDeck (content/prompts.json)
```

- **Server is the truth.** One Node.js process holds every room in memory. Clients send
  _intents_ (`join_room`, `pick_character`, `submit_answer`, `cast_vote`, …); the
  server validates against phase and identity, mutates, and broadcasts a full
  `room_state`. Clients never run authoritative timers: every phase has a server
  `phaseEndsAt` and the client draws a shrinking ring from it (with a clock offset
  computed from `serverNow` in each broadcast).
- **Shared rules module** (`shared/`) is imported by both server and client so word
  counting, validation and scoring are literally the same
  code on both sides. The client uses it for live UX; the server for the final word.
- **No persistence.** Rooms die with the process. Session tokens are HMAC signatures of
  the player id with a per-process secret; a server restart ends all games (acceptable
  for v1, documented in [Roadmap](#roadmap--known-gaps)).
- **One static bundle.** Express serves the built client from `client/dist` and upgrades
  `/ws` to WebSocket on the same port. Caddy terminates TLS in front.

| Layer    | Choice                                                                      | Why                                                                                                      |
| -------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Client   | React 19 + Vite 6, plain CSS                                                | No canvas engine needed; CSS keyframes animate the painted character sprites                             |
| Realtime | native `ws` (server) / browser `WebSocket`                                  | JSON `{type, payload}` messages exactly as the spec's protocol table; socket.io's extras were not needed |
| Server   | Node 22+, TypeScript, Express 5                                             | Express only serves static files and `/healthz`                                                          |
| Tests    | Vitest (unit + state machine with fake timers), Playwright (3-phone e2e)    |                                                                                                          |
| Fonts    | `@fontsource-variable/fredoka` (display), `@fontsource/nunito` (body)       | Self-hosted, OFL licensed; no runtime dependency on Google Fonts                                         |
| Sounds   | WebAudio synthesis in `client/src/audio/`                                   | Ships no audio assets; per-phase procedural music plus typewriter, roast, win/lose, fanfare effects      |
| Filter   | `obscenity` (MIT)                                                           | Display-only profanity masking, catches leetspeak spellings such as "sh1t"                               |
| Deploy   | Docker multi-stage image + Caddy (auto Let's Encrypt) on an Ubuntu 24.04 VM | See [Hosting](#hosting-on-cybera)                                                                        |

---

## Repository layout

```
say-less/
├── shared/src/            Rules shared by client and server (no runtime deps)
│   ├── constants.ts       Round table (limits, timers, multipliers), point values, holds/TTLs
│   ├── types.ts           Public state shapes the server broadcasts and the client renders
│   ├── protocol.ts        Client→server and server→client message unions, error codes
│   ├── words.ts           Word counting, validateAnswer()
│   ├── scoring.ts         scoreMatchup(), scoreFinal(), computePlacements(), roundTo5()
│   ├── superlatives.ts    Podium superlatives
│   └── characters.ts      Roster metadata (id, name, flavor, accent color)
├── shared/test/           Unit tests for the rules incl. the spec's worked examples
├── server/src/
│   ├── index.ts           HTTP + WS entrypoint, static serving, /healthz, graceful shutdown
│   ├── room.ts            THE state machine: one class per room (~1000 lines, read this first)
│   ├── roomManager.ts     Room registry, code generation, empty-room expiry
│   ├── bots.ts            BotCrew: server-side players for the BOTS dev room
│   ├── ws.ts              Gateway: socket↔player mapping, parsing, rate limit, dispatch
│   ├── session.ts         HMAC session tokens
│   ├── prompts.ts         PromptDeck: draw without replacement, tagged per round
│   └── roomCode.ts        4 letters, no O/I
├── server/test/           Scripted 3-player game with hand-computed scores, rule tests
├── client/
│   ├── index.html         Viewport/meta; disables zoom, safe-area aware
│   ├── src/main.tsx       Mounts App; installs the no-copy/no-contextmenu/no-drag guards
│   ├── src/App.tsx        Phase → screen router, phase → palette, error toast
│   ├── src/net/           socket.ts (reconnecting WS, intent pacing), useRoom.ts (state hook), session.ts (localStorage)
│   ├── src/components/    Backdrop, Character, TimerRing, LimitChips, WordInput, AnswerText, PlayerChip, Header, profanity (obscenity masking)
│   ├── src/screens/       Home, Lobby, CharSelect, RoundIntro, Writing, Voting, MatchupReveal, RoundResults, FinalVoting, FinalReveal, Podium
│   ├── src/styles/        global.css (tokens, palettes, no-select), characters.css (5 states), screens.css
│   ├── src/audio/         Synthesized music (sequencer, songs) and sound effects
│   └── public/sprites/    Painted WebP sprites, one per character and pose (see ASSETS.md)
├── content/prompts.json   373 prompts tagged by round
├── e2e/full-game.spec.ts  Playwright: three phone browsers play a whole game
├── deploy/                Dockerfile, docker-compose.yml, Caddyfile, cloud-init.yaml, provision.sh, deploy.sh
├── cloud/                 OpenStack CLI wrapper + credential bootstrap (secrets gitignored under cloud/secrets/)
├── tools/dechroma.py      Magenta → transparent sprite converter, plus phase backgrounds (uv run)
├── ASSETS.md              Exact art requests for generated sprites/UI
└── .github/workflows/ci.yml  format, lint, typecheck, unit, build, e2e, docker smoke
```

---

## Running locally

Requirements: Node 22+ (26 used in development), npm 10+.

```bash
npm install
npm run dev          # server on :8080 (tsx watch) + Vite on :5173 with /ws proxied
```

Open http://localhost:5173 in three browser windows (or one normal + two private windows
so sessions do not collide) to play. `npm run dev` binds Vite to all interfaces, so phones
on the same Wi-Fi can open `http://<your-lan-ip>:5173`.

Production-like:

```bash
npm run build        # server → server/dist, client → client/dist
npm start            # serves client/dist and /ws on :8080
```

**Playing alone (bot room).** Join with the code `BOTS` and the server opens a fresh
room (with its own real code) seated with four bots, Beep, Boop, Bleep and Blorp, with you
as the leader. Bots pick characters, answer with canned phrases trimmed to the limit,
vote at random, sometimes roast, and rank the final wall. They act through the same room
intents as a phone, after a random think time. Real codes never contain an O, so `BOTS`
cannot collide with one. Bots never lead, and the room expires like any other once no
human is connected. It works on the deployed server too.

Environment variables (server): `PORT` (8080), `HOST` (all interfaces when unset; the
deployment sets 127.0.0.1), `PROMPTS_PATH`, `CLIENT_DIST`. E2E: `E2E_PORT` (8090),
`E2E_BASE_URL`, `E2E_RESOLVE`, `E2E_DEVICES=1`, `SHOTS_DIR`.

---

## Tests and quality gates

```bash
npm test               # vitest: shared rules, server state machine, client components (~3 s)
npx playwright test    # builds the client, boots the server on :8090: device smoke, 3-player
                       # and 12-player games (~5.5 min)
npx playwright test --project android        # Pixel 7 Chromium
npx playwright test --project iphone-webkit  # WebKit at iPhone 13 size
node tools/evidence.mjs --base http://localhost:8190 --out evidence/<date>
                       # scripted 4-player game per device, screenshot of every stage
npm run typecheck      # tsc for shared, server, client
npm run lint           # eslint
npm run format:check   # prettier
```

What the tests pin down:

- `shared/test/scoring.test.ts` – votes × multiplier with no bonus even for a sweep,
  roast backfire steal, tie split, abstain → 0, Great Minds, random answers at half points,
  Crowd Favourite, final top-2 scoring, shared placements.
- `shared/test/words.test.ts` – hyphen/apostrophe counting, punctuation-only tokens,
  120-char cap, roasted limit of 2, no limit when word limits are off.
- `server/test/room.game.test.ts` – a scripted 3-player game LOBBY → PODIUM whose final
  scores (1800 / 1200 / 600) and votes received are hand-computed in the file header, with the final reveal
  timed by `finalRevealSchedule` and totals held back until the podium; matchup generation
  invariants for 5 players.
- `server/test/room.rules.test.ts` – redaction per phase, over-limit rejection,
  auto-submit texts, Great Minds, character race, timer-expiry assignment, roast window
  rules and a deterministic backfire steal (5 players), leader hand-off, reconnect
  re-sends prompts, lobby slot expiry, duplicate names, room full / mid-game join, word
  limits off (no limit dealt, roasts still cut to 2, final unlimited too).
- `server/test/bots.test.ts` – a bot room seats four bots with the human as leader, plays
  a whole game to the podium with the bots answering and voting, and expires once the
  human leaves.
- `e2e/full-game.spec.ts` – three iPhone-sized Chromium contexts: create/join, settings,
  character race, refresh during writing lands back on the prompt, roast overlay and
  2-word counter, all votes, final card wall, podium (Vote Magnet superlative), rematch
  returns to the same room code, and a check that the painted sprites are animating.
  Screenshots per phase land in `e2e/shots/` (gitignored).
- `e2e/twelve-players.spec.ts` – twelve contexts play a full game; every player's round
  change must equal the sum of their reveal deltas, the final points and podium totals
  must reconcile, and a 13th phone is turned away.
- `e2e/devices.spec.ts` – home to first answer on each device project; `e2e/helpers.ts`
  records layout issues (overflow, clipped text, small tap targets, low contrast, blank
  space) per screenshot into `layout-issues.json` without failing the run.
- `client/test/` – the base-path prefix on UI images, a sprite for every character and
  pose, song data, sound settings and the sound controls.
- `e2e/resilience.spec.ts` (~3.3 min) – reload and double-tap in every phase with 150 ms of
  relay latency, offline 40 s mid-write and backgrounded 60 s, two tabs on one session,
  double-tapped Create Room, rejected submits and a wrong room code, clocks 90 s off, and a
  server restart mid-game (starts its own server on port 8093).
- `server/test/room.party.test.ts` – timers off (leader moves on) and relaxed (double
  clock), pause freezing the clock and holding a phase through a disconnect, a random
  answer labelled only at the reveal, audience joining mid-game and deciding only the Crowd
  Favourite, a freed lobby seat going to the audience, kick shutting a phone out
  mid-game, a Doodle drawing refused while paused, Initials letters and validation, and a short game into an
  anonymous final voted by opaque ids.
- `server/test/roomManager.test.ts`, `clientAddress.test.ts` – per-client room limits and
  which peer's X-Forwarded-For is trusted.

CI (`.github/workflows/ci.yml`) runs all of the above plus a Docker build that boots the
image and curls `/healthz`.

---

## Game rules as implemented

Source of truth: `shared/src/constants.ts` and `shared/src/scoring.ts`.

### Rounds

| Round     | Name                | Limit    | Writing timer                                          | Multiplier |
| --------- | ------------------- | -------- | ------------------------------------------------------ | ---------- |
| 1         | Say Some            | 12 words | 120 s                                                  | ×1         |
| 2         | Say Less            | 6 words  | 120 s (first 10 s = roast window, prompts dealt after) | ×2         |
| 3 (final) | Say Nothing… Almost | 3 words  | 60 s                                                   | ×3         |

`settings.wordLimits = false` (lobby toggle, default on) lifts every limit: prompts are
dealt with `effectiveLimit: null`, the round intro reads "No word limit", the counter
shows a plain word count, and only the 120-character cap applies. A roast still cuts its
target to 2 words.

### Word counting (`words.ts`, identical on client and server)

1. Trim, collapse whitespace, split on whitespace; each token is one word.
2. Hyphenated and apostrophe words are one word (`mother-in-law's` = 1).
3. A token made only of punctuation, combining marks or invisible format characters
   (zero-width space, bidi overrides) counts 0, so "…" is 0 words and an invisible answer
   is `empty`. Braille blank (U+2800) and the Hangul fillers look like spaces and count as
   spaces, so they cannot glue a sentence into one "word".
4. Hard cap 120 characters regardless of word count.
5. Client soft-blocks: an edit that would exceed the limit and is longer than the current
   text is ignored (deletions always allowed). Server rejects with `over_limit`.
6. A roasted answer has `effectiveLimit = 2` with the same rules.

Empty on timer: connected players auto-submit "…" (`autoSubmitted: true`, wordCount 0);
disconnected players get "[left the chat]".

### Scoring (all points × round multiplier, rounded to nearest 5)

| Event                 | Points           | Condition                                                                                                                                                          |
| --------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vote received (R1–R2) | 100 per vote     |                                                                                                                                                                    |
| Roast backfire        | steal            | Roasted player wins **and** the roaster is the opponent in that matchup → the roaster's points from that matchup move to the winner                                |
| Great Minds           | flat 100 each    | Both answers normalize to the same text (case, punctuation, spacing ignored); no votes counted, no other bonuses                                                   |
| Tie                   | vote points only | Nobody wins, no bonuses                                                                                                                                            |
| All abstain           | 0 / 0            |                                                                                                                                                                    |
| Final 1st-choice vote | 200              |                                                                                                                                                                    |
| Final 2nd-choice vote | 100              |                                                                                                                                                                    |
| Random answer         | half vote points | Stock answer: `POINTS.BAIL_OUT_SHARE` of its vote points (matchup or final)                                                                                        |
| Crowd Favourite       | +100             | The answer the audience preferred (matchups: more audience votes; wall rounds: the single most-voted, ties pay nobody). Audience votes never count as player votes |

A win pays its votes and nothing more: there are no bonuses for a clear win or a sweep.
Podium ties share a place (1, 1, 3). Superlatives: Vote Magnet (most votes received across
matchups and walls), Wordiest Loser (words per point among non-winners), Roast Victim,
Fastest Submitter.

### Matchups

Custom mode: all unused custom prompts are matched to pairs that do not include their
author (maximum bipartite matching), leftover pairs take any other unused custom prompt,
then the packs fill the rest, so nobody answers their own prompt whenever that is
possible. Doodle drawings are dealt the same way (the artist is the author). The final
takes a leftover custom prompt (everyone answers it, its author included), else in Doodle
the most-voted drawing of the game, else the packs.

**Prompts that name a player.** A prompt may contain `{player}` (every prompt in the Group
Chat pack does). At the deal it becomes the name of someone in the room who is not one of
that prompt's two writers; in the final, anyone.

Players are shuffled into a ring; matchup _i_ is player _i_ vs player _i+1 (mod N)_ with
prompt _i_. Every player writes exactly two answers, every prompt gets exactly two
answers, for any N ≥ 3. Prompts are drawn without replacement for the whole room session
(rematches included), preferring prompts tagged for that round and falling back to any
unused prompt, then to reuse.

### Roast tokens

- Exactly one per player per game (reset on rematch). Usable only during the first 10 s
  of round 2's writing phase (`roundIndex === 1`, `phase === WRITING`, before prompts
  are dealt).
- One roast per target per round; a second spender gets `already_roasted`. No self-roast.
- Applies to the target's first matchup that does not already carry a roast; one roast per
  matchup, and an earlier roast may move to its own target's other matchup before prompts
  are dealt (on a ring this always succeeds). The target gets a private `roasted` message
  and a full-screen overlay before the prompt appears.
- Backfire: whenever the roasted target beats the roaster, the winner gets a `steal` award
  (stamped BACKFIRE!), even if the roaster scored 0; `stolen` (ROBBED) only appears when
  points actually move. Without the 0-point stamp a backfire could never show in 3 or 4
  player games, where the roaster always loses 1-0 or 2-0.
- `settings.roasts` (lobby toggle, default off): off skips the window entirely.
- Unused tokens are worthless at the podium.

---

## State machine and timers

```
LOBBY ─start(leader, ≥3; unpicked get random characters)─▶ ROUND_INTRO (4s)
  ▲                                                             │
  │                        ┌────────────────────────────────────┘
  │                        ▼
  │   Doodle: ROUND_INTRO ─▶ CREATING (75s draw) ─▶ WRITING …   Out of Context, every round:
  │   ROUND_INTRO ─▶ CREATING (45s) ─▶ FINAL_WRITING ─▶ FINAL_VOTING (one vote) ─▶ FINAL_REVEAL ─▶ ROUND_RESULTS
  │   rounds 1–2:   WRITING (120s) ─all in / timer─▶ VOTING (20s) ─▶ MATCHUP_REVEAL (6s) ─┐
  │                                                        ▲                                │
  │                                                        └── next matchup ────────────────┤
  │                                                                                         ▼
  │                                                                          ROUND_RESULTS (8s)
  │                                                                                         │
  │   round 3:      ROUND_INTRO (4s) ─▶ FINAL_WRITING (60s) ─▶ FINAL_VOTING (25s)           │
  │                 ─▶ FINAL_REVEAL (finalRevealSchedule: 1.5s + 2.5s per answer + 2s) ─▶ PODIUM
  │                                                                              │          │
  └────────────────────────── rematch(leader) ───────────────────────────────────┘◀─────────┘
```

Every phase with a timer schedules a single `setTimeout` in `Room.enterPhase`; early
completion (everyone submitted / voted) clears it and advances. Writing, drawing and voting
clocks go through `phaseClock(ms, settings.timers)`: doubled when relaxed, `null` (no
timer, `phaseEndsAt: null`) when off, in which case `advance_phase` from the leader runs the
same transition the timer would have. A short game's `ROUND_RESULTS` leads to round 3.
**Pause** clears the phase and roast timers and stores what was left; resume reschedules
them and shifts `phaseStartedAt` by the pause length, so every client's ring and the final
reveal schedule pick up where they stopped. While paused, intents that change the game are
refused with `paused` and presence changes do not advance anything. The roast window is a
second timer inside WRITING. A matchup with no eligible connected voters reveals
immediately. `Room` uses the global clock so tests drive it with Vitest fake timers.

---

## WebSocket protocol

Endpoint: `/ws`. Frames are JSON `{ "type": string, "payload": object }`.
Max frame 40 KiB (server) / 4 KiB parse guard, except `submit_drawing` (up to 32 KiB; a
typical doodle encodes to about 3.4 KB, see `shared/src/drawing.ts`). Rate limit: one intent per 250 ms per
socket (`rate_limited`); the client paces its own sends to that gap so a double-tap is
delayed, not dropped. `ping` is exempt.

Client → server: `create_room {name}`, `join_room {code, name, sessionToken?}`,
`update_settings {profanityFilter?, wordLimits?, roasts?, promptMode?}` (leader, LOBBY),
`add_prompt {text}` / `remove_prompt {promptId}` (LOBBY; authors or the leader remove), `start_game {}`
(leader, LOBBY, ≥3), `pick_character {characterId}` (LOBBY), `spend_roast
{targetId}` (WRITING, round 2, first 10 s), `submit_answer {promptId, text}` (also the Out of Context honest answer in CREATING),
`submit_drawing {promptId, drawing}` (CREATING, Doodle)
(WRITING/FINAL_WRITING), `cast_vote {matchupIndex, answerIndex}` (VOTING),
`cast_final_votes {first, second}` (FINAL_VOTING; wall answer ids, see `PublicAnswer.answerId`;
the audience sends one id and an empty second), `rematch {}` (leader, PODIUM),
`advance_phase {}` (leader, timers off), `pause_game {}` / `resume_game {}` (leader),
`bail_out {promptId}` (WRITING/FINAL_WRITING), `kick_player {playerId}` (leader),
`leave_room {}`, `ping {}`.

Server → client: `welcome {playerId, sessionToken, code}`, `room_state <PublicRoomState>`
(on every mutation), `your_prompts {prompts: [{promptId, text, effectiveLimit, mode,
matchupIndex, submittedText}]}` (private; at deal time, after each accepted submission,
and on reconnect), `roasted {byName}` (private), `reveal {matchupIndex}`, `drawings {items: {id: encoded}}` (each drawing sent to each
player once, just before the state that shows it, and again after a reconnect), `error {code,
message}`, `left {}`, `pong {serverTime}`.

Error codes: `over_limit, already_roasted, char_taken, bad_phase, room_full, not_found,
rate_limited, invalid, not_leader, bad_name, not_enough_players, too_long, empty,
self_target, no_token, already_submitted, bad_initials, paused`.

`PublicRoomState` (see `shared/src/types.ts`) carries: code, phase, `phaseEndsAt`,
`phaseStartedAt`, `serverNow`, roundIndex, players (public fields only), leaderId,
settings, `customPrompts` (id, text, authorId), matchups (redacted, see below), currentMatchupIndex, `roastWindowEndsAt`,
`submittedIds`, `votedIds`, `final` (prompt, mode, limit, letters, answers, votes, result),
`podium`, `banner`, `gamesPlayed`, `paused` (who paused, time left), `audienceCount`,
`highlights` (podium only) and `viewer` (per recipient: `role` player or audience, and
`finalAnswerId`, the viewer's own id on the wall so they cannot vote for it).

---

## Redaction and anti-cheat

Implemented in `Room.publicMatchup` / `Room.publicFinal` and covered by
`room.rules.test.ts › redaction`:

| Data                                              | Hidden until                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Matchup prompt text                               | that matchup's VOTING phase opens                                                 |
| Answer text                                       | that matchup's VOTING phase opens                                                 |
| Answer author, word count, effective limit, roast | that matchup's MATCHUP_REVEAL                                                     |
| Individual votes                                  | MATCHUP_REVEAL                                                                    |
| Who has voted (`votedIds`) during VOTING          | never: each viewer sees only their own id, since the non-voters are the authors   |
| Final answers                                     | FINAL_VOTING (author visible because final votes are cast by player id, per spec) |
| Final individual votes and tallies                | FINAL_REVEAL (the reveal needs them; totals still wait for PODIUM)                |
| Another player's prompts                          | never sent                                                                        |
| Random answer flag                                | that matchup's MATCHUP_REVEAL (final: FINAL_REVEAL)                               |
| Final authors with Anonymous final on             | FINAL_REVEAL; the wall uses random per-final ids and is sorted by them            |
| Audience votes                                    | counts only, in the result at the reveal                                          |

Clients cannot read the payload to learn who wrote what before the reveal. The client
also cannot copy displayed text (CSS `user-select: none`, `copy`/`contextmenu`/`dragstart`
suppressed outside inputs) and images ignore pointer events and drags.

---

## Reconnect and presence

- On `welcome` the client stores `{code, sessionToken, name}` in `localStorage`. On any
  socket (re)open with a stored session it sends `join_room` with the token; the
  gateway verifies the HMAC, re-binds the socket to the player, and the room re-sends
  `room_state`, `your_prompts` and any pending `roasted`.
- A second tab with the same token takes over the seat; the old tab shows "Open in another
  tab" with a Play here button (they coordinate over `BroadcastChannel`), so no ghost
  player and no tab stuck on stale state.
- A dead connection is detected by a heartbeat; the client opens a fresh socket at once and
  closes the old one only after the new one hears from the server, so the server never
  sees a gap. Coming back from the background does the same.
- An intent that may have been lost (sent while offline or into a dying socket) shows
  "Connection lost. Try that again." and re-enables the form with the draft kept. Start,
  vote, final votes, rematch, create and join are sent at most once per phase, so a
  double-tap never produces a second intent or an error toast.
- A rejoin whose room no longer exists shows "That room is gone." once and clears the
  session. The server refuses any join carrying a token that is not a member of that room
  (tokens are per server process and codes can be reused), rather than seating a stale
  phone in a stranger's lobby.
- Disconnect mid-write: the player's unanswered prompts become "[left the chat]" _when
  the phase ends_; if they return before that, they can still write. Mid-vote: abstain.
- Grace: a player dropped for under 15 s (`DISCONNECT_GRACE_MS`) still counts as playing,
  so an iPhone switching apps does not end writing or voting early for everyone. After
  the grace a per-player timer re-checks and they are ignored, so a dead phone never
  stalls the game. An explicit leave gets no grace.
- Sitting out: when a round starts with three or more players connected, players gone
  past the grace are not dealt in (so nobody faces "[left the chat]" all round). They
  keep their score, count as done, see the waiting room with an explanation if they
  return, can vote, and are dealt back in next round.
- Slot hold: 30 s in LOBBY, 3 min elsewhere; after that a disconnected player is removed
  only in LOBBY/PODIUM (mid-game the seat stays so matchups keep their references; they
  are dropped at the next start/rematch).
- Leader disconnect: leadership is held through the 15 s grace, so a creator who reloads
  keeps the Start button; then it passes to the longest-connected player and `banner`
  announces it. An explicit leave passes it at once.
- **Audience** members have no seat, character or score. They rejoin with their session token
  like players, are held for 3 min when they drop, never hold up a phase, and never lead.
  In the lobby a freed seat goes to the first connected audience member.
- **Removed by the leader**: the phone gets `left` and a "The leader removed you" toast. In
  the lobby or podium the player is removed outright; mid-game the seat is marked `kicked`
  (`hasPlayer` is false, so their token no longer rejoins) and their unanswered prompts
  become "[left the chat]" at the phase end. Nothing stops them joining again under a new
  name in the next lobby.
- Empty rooms (no connected players) are destroyed after 5 min; an emptied lobby that
  never started a game after 60 s.
- Room creation is capped per client (IPv4 address or IPv6 /64): 5 live rooms and 10
  creations per 10 minutes (`LIMITS` in `shared/src/constants.ts`). X-Forwarded-For is
  trusted only from a loopback peer, which is why the app container runs on host
  networking bound to 127.0.0.1 behind Caddy.

---

## Client design

- **Mobile-first**, tested at 390×844 (iPhone 13 profile) in Chromium; scales to desktop
  with a 560 px content column (900 px for grids). `100dvh`, safe-area insets, no zoom.
- **Palettes rotate per phase** via `data-palette` on the root: home (navy/yellow), lobby
  (purple/lime), writing (purple/orange), voting (teal/pink), results (yellow/navy),
  podium (navy/yellow). Tokens live in `global.css`.
- **Word-limit tiles** (`LimitChips`) are always in the header during writing and are
  the round-intro motif: tiles above the new limit shatter and fall.
- **Timers** are always rings (`TimerRing`), driven by `phaseEndsAt` minus the local
  clock plus `clockOffset`; last 5 s tick and pulse red.
- **Answers** render in the display font at a size chosen from text length
  (`AnswerText`), with an optional typewriter effect where shorter answers type slower
  per character. Profanity masking applies for everyone but the author when the filter
  is on.
- **Character component** renders the painted WebP sprite for the character and state
  straight away, with nothing to load first; `characters.css` animates it. A unit test
  fails if any character lacks a pose, and the full-game test fails if a sprite is not
  animating.
- **Audio** is all WebAudio, no files: `client/src/audio/` holds a look-ahead sequencer
  (`music.ts`, 25 ms tick, 100 ms horizon), song data per phase (`songs.ts`: lobby F major
  92 bpm, writing A minor 96 bpm with a clock tick, voting C major 124 bpm, results D
  dorian vamp, podium fanfare; silence during reveals), instruments, effect recipes, and
  a bus graph. Each looping song is an arrangement of named sections played in order, so
  it runs a long time before repeating: lobby 64 bars (about 2:47), writing 40 bars
  (100 s, longer than any writing phase), voting 36, podium 32 after its fanfare, results 16. A loop that fades out resumes on the bar it had reached (`LoopBookmarks`), so the
  voting music carries on across matchups instead of restarting at every reveal. The
  graph has reverb, compressor, limiter and ducking under effects. Music sits
  about 10 dB under effects. `SoundControls` gives separate Music and Sound effects
  switches (`say-less.music`, `say-less.muted` in localStorage); it lives in the header,
  and in the top corner of Home, Lobby and Podium. Nothing plays before the first tap,
  the context suspends when the tab is hidden, and iOS's silent switch is respected.
- **Scrolling** resets to the top on every phase and matchup change.
- **Leader row** (`HostControls`) sits under the header, not in it: on a 390 px phone the
  header has no room for more buttons.
- **Hurry-up**: anyone who still owes an answer gets a "15 seconds left!" banner and a tick
  (`TIMERS.HURRY_UP_MS`).
- **Initials** prompts show letter tiles that light up as each word matches (`LetterTiles`).
- **Two taps** for anything irreversible (Random answer, Remove): `ConfirmButton` arms on
  the first tap and disarms after 4 s.
- **Accessibility**: an `aria-live` announcer reads one sentence per event (round, matchup,
  winner, scoreboard leader, podium); the sound menu has a **Calm motion** switch
  (`say-less.calm`) that applies the same animation cut as the OS reduced-motion setting.

---

## Characters and art pipeline

Roster and accent colors: `shared/src/characters.ts`. The cast is **the Cryptids**,
eighteen legendary creatures drawn as lovable cartoon characters: Bigfoot, Yeti, Nessie,
Mothman, Jackalope, Kraken, Kappa, Alien, Ghost, Chupacabra, Flatwoods, Werewolf, Vampire,
Skeleton, Phoenix, Unicorn, Gargoyle and Cerberus. A room still seats twelve; the other six
widen the choice. Each has five painted poses (`idle`, `writing`, `waiting`, `win`, `lose`)
in `client/public/sprites/<id>/<pose>.webp`. `Character.tsx` shows them directly and
`characters.css` animates the whole image per state (`.char-sprite img`): breathe,
scribble, fidget, hop, sulk. The accents for name chips and vote bars are measured from
the cut sprites, not taken from the prompts, because the painted colours drifted. UI images render
through `client/src/components/UIArt.tsx`, which crops each one to its painted bounds from
`client/public/ui/manifest.json` and prefixes `import.meta.env.BASE_URL` so the same build
works at the domain root (Cybera) and under `/say-less/` (GitHub Pages). Each phase palette
also has a painted background in `client/public/backgrounds/`, drawn by
`client/src/components/Backdrop.tsx` as a fixed layer so it stays put while long screens
scroll; it fades in on each phase change, and all six are fetched shortly after the first
screen so a change never waits on a download.

To change art, follow `ASSETS.md` (filenames, sizes, prompts, **magenta #FF00FF
background**), drop files under `art/raw/`, then:

```bash
uv run tools/dechroma.py
```

This keys out the magenta (only patches that hold true key colour, so pink walled in by
the outline stays), despills edges, gives each separate piece of art to its grid cell (so
a wide pose can reach over its neighbour's space without being clipped), trims, squares,
resizes to 512 and writes WebP (quality 88, about a fifth of the PNG size) plus the UI
manifest. Backgrounds under `art/raw/backgrounds/` are
converted to WebP without keying (about 150 KB for all six). Commit the outputs under `client/public/`; the whole
`art/` folder is gitignored.

**Art provenance.** The Cryptids, their icons, podium stands, how-to pictures and the share
card were generated on 2026-10-20 with ChatGPT's built-in image tool from the prompts in
`ASSETS.md`, after two cast lineups that every later prompt attached. They replaced the
first cast of twelve animals, which feedback found too "AI-looking" and out of place; that
set, a rejected speech-bubble draft and the lineup drafts are kept locally under
`art/archive/`. Sheets came back at 1254 x 1254 (podium 1774 x 887, share card 1536 x 1024).
The how-to "vote" cell was redone as a single portrait image. The logo, app icons and the
six phase backgrounds come from the first set (2026-09-24 and 2026-09-25) and were kept.
`art/raw/final/icon-rounded-original.png` is not used: the generator punched blotchy
transparent holes through its background, so the opaque icon supplies every icon size.

---

## Prompt bank

**Packs.** The host ticks any mix of packs in the lobby (Classic and Group Chat by
default); `shared/src/packs.ts` is the catalog and `content/packs/<id>.json` the prompts:
Group Chat (`friends`, every prompt names a player), Food Fight, 9 to 5, Extremely Online,
Movie Night, Family Friendly, Road Trip (`travel`), School Daze (`school`), Out of This World
(`fantasy`), Home Sweet Home (`home`), Love Life (`love`, cheeky but not adult; added
2026-10-18), and After Dark (18+, off by default). About 55 prompts each;
`server/test/packs.bank.test.ts` holds them to the classic bank's rules plus the catalog,
cross-pack uniqueness and the `{player}` rule. `content/doodles.json` (97 drawing
suggestions) and `content/questions.json` (128 opinion questions for Out of Context) feed the two modes.

**Random answers.** `content/bailouts.json`: 148 original stock answers, mostly one to three
words so a roasted (2) or final (3) answer always has some that fit. Each is dealt once per
room session before any repeats.

**Classic.** `content/prompts.json`: 407 prompts (a second editorial pass on 2026-09-29
rewrote 31 flat ones, retired 3 and added 37), `{ id, text, rounds }` where `rounds ⊆ [0,1,2]`.
367 are usable in round 1, 372 in round 2, 286 as final prompts (tag 2 only goes on
prompts that land in one to three words). Tone is absurd and cheeky; nothing about real
people, groups, brands, religion or politics; no adult tier; plain ASCII, blanks written
`___`. The bank had an editorial pass on 2026-09-24 (154 kept, 77 rewritten, 14 retired,
142 added). `server/test/prompts.bank.test.ts` locks the bar: minimum counts per round,
unique ids that never reuse a retired one, length, punctuation, no near-duplicates (same
first five words), at most 8 prompts sharing an opening pair of words, and a banned list
of brands and public figures. Add prompts by appending with the next id and run
`npm test`.

---

## Hosting on Cybera

Cybera Rapid Access Cloud (OpenStack, region Edmonton). Project quota: 8 instances,
8 vCPU, 8 GB RAM, **0 floating IPs**. Instances get a private IPv4 (10.2.x) and a public
IPv6, plus an automatic DNS name `<hex>.yeg.rac.sh` (AAAA record only) stored as the
server property `dns` and readable from the instance metadata service.

| Instance        | Role                                       | Address                                                    |
| --------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `say-less-prod` | this game, m1.micro (1 vCPU / 1 GB / 5 GB) | `38dcd.yeg.rac.sh`, `2605:fd00:4:1001:f816:3eff:fe84:1b3a` |

**Why m1.micro.** Every room lives in the server's memory and a full eight-player room is
a few kilobytes, so serving a game costs almost nothing: under load the `app` container
holds ~22 MB and Caddy ~38 MB, leaving over 500 MB free. The only demanding moment is the
in-place Docker build, which needs more than 1 GB of RAM and about 800 MB of scratch disk.
The flavor's own 1 GB swap partition covers the first; pruning the build cache after each
build covers the second, and the root settles at ~59% full. A full three-browser Playwright
game passes against this instance.

Consequence of no floating IP: **the game is reachable over IPv6 only.** Canadian mobile
carriers are IPv6, most home ISPs are too, but a phone on an IPv4-only Wi-Fi network
cannot connect. The chosen fallback if that bites is a Cloudflare Tunnel (free) on the
instance, which needs a domain on Cloudflare and one `cloudflared` login; it replaces the
Caddy service in `deploy/docker-compose.yml` and nothing else changes.

On the instance: Docker CE, `/opt/say-less` is a clone of this repo, `deploy/.env` holds
`SITE_ADDRESS=<dns name>`, and `docker compose` runs two containers: `app` (the game,
bound to 127.0.0.1:8080) and `caddy` on host networking (binds :80/:443 on v4 and v6,
auto-provisions Let's Encrypt, proxies to the app). `ufw` allows 22/80/443.

OpenStack access from a laptop: `cloud/os` wraps the `openstack` CLI (Python venv) with an
application credential in `cloud/secrets/clouds.yaml` (gitignored; mint one with
`cloud/bootstrap_credential.py`). The SSH key is `cloud/secrets/say-less.pem`.

---

## Deployment runbook

```bash
# one-time: create the VM (idempotent) – installs Docker and starts the stack via cloud-init
deploy/provision.sh say-less-prod m1.micro

# every release: push main, then
deploy/deploy.sh say-less-prod           # ssh: git reset to origin/main, compose up --build
deploy/deploy.sh say-less-prod --logs    # bootstrap log + compose ps + recent container logs

# manual access
ssh -i cloud/secrets/say-less.pem ubuntu@2605:fd00:4:1001:f816:3eff:fe84:1b3a
sudo tail -f /var/log/say-less-bootstrap.log
cd /opt/say-less/deploy && sudo docker compose logs -f
```

Health: `curl -6 https://38dcd.yeg.rac.sh/healthz` → `{"ok":true,"rooms":N,"prompts":1075}`.

**Play stats.** `https://38dcd.yeg.rac.sh/stats?key=<STATS_KEY>` (or `/stats.json?key=...`)
shows online now (players in seats, audience, open rooms), all-time totals and one row per
day for the last 90 days. Without the right key it answers 404. Definitions: _players_ are
distinct devices seated in a game that started; _visitors_ are distinct devices that joined
any room (the audience included); _seats_ add up every started game's human players; peak
online is sampled every 30 s. A device is an anonymous random id the browser keeps in
`localStorage` (`say-less.device`); the server stores only a 16-character SHA-256 prefix of
it, never names or IPs. Bots are never counted. Days follow `STATS_TZ`
(`America/Edmonton`).

Storage: `server/src/stats.ts` keeps everything in memory and writes `STATS_PATH`
(`/data/stats.json` on the `app_data` volume, so it survives deploys) at most every 5 s and
on shutdown, atomically. A file that cannot be read is renamed to
`stats.json.corrupt-<time>` and counting starts fresh, so history is never overwritten.
Without `STATS_PATH` (local dev) counts live in memory only. `STATS_KEY` is in
`/opt/say-less/deploy/stats.env` on the instance (gitignored, loaded by compose); a copy is
in `cloud/secrets/stats-key`. Change it by editing that file and running
`cd /opt/say-less/deploy && sudo docker compose up -d app`.

Rollback: `ssh … 'cd /opt/say-less && git reset --hard <sha> && cd deploy && sudo docker compose up -d --build'`.

Restarting the `app` container ends every in-progress game (rooms are in memory);
deploy between sessions.

Cloud-init (`deploy/cloud-init.yaml`) on first boot: adds Docker's apt repo, installs
Docker CE + compose plugin, enables ufw, clones the public repo, reads `.meta.dns` from
`http://169.254.169.254/openstack/latest/meta_data.json`, writes `deploy/.env`, and runs
`docker compose up -d --build`. Log: `/var/log/say-less-bootstrap.log`. It also drops the
apt caches and the Docker build cache, which together are ~1.2 GB on a 5 GB root, and adds
a swapfile only if the flavor did not already attach swap.

**The DNS name belongs to the instance, not to the project.** Replacing the instance gets a
new `<hex>.yeg.rac.sh`, and the forward AAAA record takes roughly an hour to publish (the
PTR exists immediately). So rebuilding the server means editing `VITE_WS_URL` in
`.github/workflows/pages.yml` to the new name and pushing; keep the old instance running
until the new record resolves and its certificate is issued.

---

## Deviations from the build spec

Recorded so nobody re-derives them.

| Spec                                          | Implemented                                                                                                                       | Why                                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ROUND_RESULTS → FINAL_WRITING` directly      | `ROUND_RESULTS → ROUND_INTRO → FINAL_WRITING`                                                                                     | The shattering 6 → 3 tiles is the signature motif; skipping it for the final felt wrong. 4 s cost.                                       |
| Final voting anonymity unspecified            | Authors visible on the final card wall                                                                                            | `cast_final_votes` is keyed by player id per the spec's protocol; matchup voting stays anonymous.                                        |
| Mic Drop: "≤ half the limit and won"          | no Mic Drop (nor Silenced!)                                                                                                       | Owner's call, 2026-10-20: a win pays its votes only; the round multipliers carry the drama.                                              |
| `stats: {micDrops, silenced, wordsUsedTotal}` | `votesReceived` in place of the first two, plus `roasted, submissions, submitMsTotal`                                             | Needed for the Roast Victim and Fastest Submitter superlatives.                                                                          |
| Error codes list                              | plus `rate_limited, invalid, not_leader, bad_name, not_enough_players, too_long, empty, self_target, no_token, already_submitted` | Distinct client messages.                                                                                                                |
| Profanity masking "in displayed answers only" | done on the client from the shared list                                                                                           | Keeps one broadcast per mutation instead of per-player payloads; the author is identified by comparing against their own submitted text. |
| Roast window "R2+"                            | round 2 only                                                                                                                      | The spec's protocol table says `spend_roast` is valid in `WRITING` only, and the final has no matchups for the backfire rule.            |
| Disconnected mid-write → "[left the chat]"    | applied at phase end, not at disconnect                                                                                           | Lets a quick reconnect still answer.                                                                                                     |
| Sounds: "typewriter, mic drop, roast sting"   | synthesized with WebAudio                                                                                                         | No asset licensing; swap for samples later if wanted.                                                                                    |
| Characters: hand-built SVG                    | painted raster sprites only (the placeholder SVGs were removed on 2026-10-21)                                                     | The owner generated the final art in ChatGPT; see `ASSETS.md`.                                                                           |

Nothing in the spec's _locked decisions_ was changed: fully online, player voting only,
flat-vector art direction, one unique character per player.

---

## Decisions log

- **2026-10-21** New cast: the twelve animals became eighteen Cryptids, with new icons,
  podium stands, how-to pictures (one more, for "Rounds get bigger") and share card. The
  placeholder SVGs and the sprite manifest are gone: every character has every pose, so
  `Character` shows the sprite on the first render, and a unit test guards the set. The
  art cutter now cuts by piece instead of by row and column bands, because the new poses
  sit close and the wide lose poses reach past their cell; it also only keys magenta
  patches that hold true key colour, so the Unicorn's pink inner ears stay opaque. The
  stamp images and the mic icon were deleted. Third place on the podium no longer shows the
  losing pose.

- **2026-10-20** Simpler scoring: Mic Drop and Silenced! are gone, along with the
  full-screen mic drop and its sound, so a win pays 100 per vote × the round multiplier.
  Multipliers are now ×1 / ×2 / ×3 (were ×1 / ×1.5 / ×2) so the final can still swing the
  game. Great Minds, Backfire!/Robbed, Crowd Favourite and the random answer stay, drawn by
  the game as text tags rather than painted stamps. Bail Out is renamed "Random answer"
  everywhere players see it (internal names keep `bailOut`). The Most Mic Drops and The
  Silencer superlatives became one, Vote Magnet. The art is being redone (see
  `art/new-art-prompts.md`, local); the stamp images and the mic icon are unused until then.

- **2026-10-18** Play stats: a private `/stats` page behind `STATS_KEY` rather than a
  public counter; players counted by anonymous device id (hashed) so one friend playing five
  games counts once; totals plus 90 days of daily rows. Stored as one JSON file on a Docker
  volume rather than a database: a few kilobytes, written a few times a minute at most.

- **2026-10-18** After the first live session: the per-answer Censor button is gone (feature
  removed end to end; the profanity filter still masks words). The final reveal is faster
  (1.5 s lead, 2.5 s per answer, 2 s hold, was 2 / 3.5 / 2.5). Reveal sounds redone: each
  final answer is a soft pop whose bell climbs a C major scale toward the winner, the winner
  gets a bell fanfare instead of the mic-drop thud, Silenced! has its own "shh" and bell, and
  losing a matchup is a soft two-note marimba instead of the brass wah-wah. Offline renders
  through the real bus (`AudioGraph` on an `OfflineAudioContext`): fanfare -7 dBFS peak / -20
  RMS, silenced -9 / -21, lose -10 / -21, reveal pop -13 / -22.5, against the voting chime's
  -10 / -21; no clipping. Mic Drop keeps its thud. The podium leads with the total scores;
  the last question's points moved to the bottom (players read them as the final standings).
  An editorial pass rewrote 149 prompts (66 cross-game repeats, 33 of them in the new packs,
  plus awkward, flat, off-tone and mis-tagged ones), keeping their ids. Five new packs (Road Trip, School Daze,
  Out of This World, Home Sweet Home, Love Life; 55 prompts each, 36 to 41 final-tagged),
  checked against every existing prompt for exact and near duplicates.

- **2026-10-18** Party features: timer speed (Normal / Relaxed / Off with Move on), pause,
  Bail Out (stock answer for half points), leader remove, audience with a Crowd
  Favourite bonus, seats, short game, anonymous final, Initials mode, round highlights on the
  podium, a hurry-up banner, Calm motion and screen-reader announcements. All names, text and
  art are original. Audience is on by default, so a full room or a game in progress now seats
  newcomers in the audience instead of refusing them. Not adopted: passwords, hidden room
  codes and streaming logins (there is no shared screen), and rejecting input for hate
  speech (needs a vetted word list).
- **2026-09-25** Music is procedural WebAudio like the effects, not audio files: zero
  download, no licensing, and it can react per phase. It was designed, not listened to,
  during development; levels were verified by offline renders (music about -32 dBFS RMS,
  effects about -22, no clipping). Roasts became a lobby setting at the user's request.
  Art is served as WebP (2.2 MB instead of 12 MB).
- **2026-09-25** The whole `art/` folder is gitignored; only processed art under
  `client/public/` is committed. `og:image` points at the GitHub Pages copy of the share
  card because the game server is IPv6-only and most link-preview crawlers fetch over IPv4.
- **2026-09-24** Party size 3–12 (was 3–8) at the user's request, and the roster swapped to
  the Reel Town animals plus three more so the art can be shared between the two games.
  Twelve players means twelve matchups per round (about six minutes of voting and reveal
  per round); the timers were left as they are.
- **2026-09-23** Rebuild the server on an m1.micro (1 vCPU / 1 GB / 5 GB) and delete the
  m1.medium, reusing the name `say-less-prod`. Measured runtime cost is ~60 MB across both containers,
  so the larger flavor was buying nothing and holding half the project's RAM quota. The
  5 GB root only works because the build cache is pruned after every build; see Hosting.
- **2026-09-21** Host on a new dedicated m1.medium (`say-less-prod`); this uses the last
  of the project's RAM quota. IPv6-only via the rac.sh
  name + Let's Encrypt, chosen over a Cloudflare Tunnel. Public GitHub repo, commits per
  milestone on `main`, no secrets committed (`cloud/secrets/` is gitignored).
- **2026-09-21** `shared/` is a plain source folder imported by relative path (server) and
  Vite alias (client), not an npm workspace package: Node's type stripping does not run on
  `node_modules`, and a workspace symlink to `.ts` sources broke `tsx`.
- **2026-09-21** Relative imports use `.ts` extensions with TypeScript's
  `rewriteRelativeImportExtensions`, so the same source runs under `tsx`, Vitest, Vite and
  compiles to `.js` for the Docker image.
- **2026-09-21** Caddy runs with `network_mode: host` so it binds IPv6 directly instead of
  relying on Docker's IPv6 port publishing.
- **2026-09-21** Client paces intents to the server's 250 ms rate limit; found by the e2e
  test when a settings tap followed by Start was rejected.

---

## Roadmap / known gaps

Ordered by what would improve the game most. Everything here is known and deliberate;
nothing in this list is a regression.

**Next up**

- **Core art is complete.** All 90 poses, 17 UI images, app icons and share card are wired.
  Generation prompts, the phase backgrounds and the wanted extras (game-mode pictures,
  confetti) are in `ASSETS.md`.
- **Manual phone test.** The e2e suite drives Chromium and desktop WebKit at phone sizes,
  up to twelve players; a real session on real phones over the public URL has not
  happened yet. That is the only way to catch iOS Safari's keyboard, audio unlock, silent
  switch and backgrounding behaviour, and to judge how a twelve-player round feels (about
  six minutes of voting per round on the current timers).
- **Listen to the music.** It was composed as data and verified by offline level renders,
  never heard. Tempo, voicing and mix may want tuning by ear (`client/src/audio/songs.ts`).
- **Known small leaks, accepted for now.** A roast-token holder can probe `spend_roast` and
  learn from `already_roasted` that a player was roasted. An answer that auto-submitted
  ("…") or "[left the chat]" hints at its author before the reveal. None of these change
  scores.
- **IPv4 reachability.** See Hosting; add a Cloudflare Tunnel if friends on IPv4-only
  Wi-Fi cannot connect. The GitHub Pages front end loads over IPv4, but its WebSocket
  still goes to the IPv6-only server.
- **Server restarts kill rooms.** Rooms are in memory, so a deploy ends every game in
  progress. Persisting them (Redis or a JSON snapshot) would allow zero-downtime deploys.
- **No metrics.** `/healthz` reports room and prompt counts; there are no dashboards.
- **Accounts, localization** – explicit non-goals for v1. (Audience mode shipped
  2026-10-18.)
- **Removed players can come back** under a new name in the next lobby; there is no ban
  list because players have no identity beyond the session.
- **`npm start` cannot find `content/`** from the compiled server: `server/src/index.ts`
  looks for `content` relative to `server/dist/server/src` and misses by one level. The
  Docker image is unaffected (it sets `PROMPTS_PATH`); locally, set `PROMPTS_PATH` and
  `CLIENT_DIST`. Found 2026-10-18, not fixed.

---

## Troubleshooting

| Symptom                                                | Check                                                                                                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone shows "Reconnecting…" forever                    | Is the phone on IPv6? `https://test-ipv6.com`. IPv4-only Wi-Fi cannot reach the instance.                                                           |
| `deploy.sh` cannot SSH                                 | Your laptop needs IPv6 too (`curl -6 https://ifconfig.co`). Do not bracket the IPv6 in the ssh host.                                                |
| Certificate errors right after provisioning            | Caddy needs the AAAA record to resolve and ports 80/443 open; `docker compose logs caddy`. Let's Encrypt rate limits: 5 failures/hour per hostname. |
| "That game is already in progress" when a friend joins | New players can only join in LOBBY; returning players need the same browser (session token).                                                        |
| Rooms vanish                                           | The `app` container restarted (deploy or crash). `docker compose logs app`.                                                                         |
| Vitest fails with fake-timer weirdness                 | `Room` schedules everything with global `setTimeout`; call `vi.useFakeTimers()` before creating a room.                                             |
| Playwright wants WebKit                                | The config forces `browserName: 'chromium'` with the iPhone viewport; run `npx playwright install chromium` once.                                   |
