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
- **Status:** v1 complete through milestone M6 of the spec; placeholder art; see [Roadmap](#roadmap--known-gaps)

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
   Start button and settings: game mode (Classic bank or Custom, where players write the prompts), profanity
   filter, emoji final round. In Custom mode anyone in the lobby can add prompts; they
   are dealt first, nobody gets a prompt they wrote, and the bank fills any shortfall.
2. **Pick a character in the lobby**: twelve characters, first tap locks it for everyone.
   Anyone who hasn't picked when the leader presses Start gets a random leftover.
3. **Round 1 "Say Some"** – 12 words, 90 s, ×1 points. Each player gets two prompts;
   each prompt is answered by exactly two players (ring pairing).
4. **Voting** per matchup (20 s): the two answers are shown anonymously; the players who
   did not write them vote. Then a 6 s **reveal**: characters slide in, vote bars fill,
   bonus stamps slam in.
5. **Round 2 "Say Less"** – 6 words, 60 s, ×1.5. The first 10 s of the writing phase is
   the **roast window**: each player holds one roast token for the whole game and may
   spend it on one opponent, cutting that opponent's next answer to 2 words. If the
   roasted player wins the matchup anyway, they steal the roaster's points from it. The
   leader can switch roasts off in the lobby (`settings.roasts`), which skips the window.
6. **Final round "Say Nothing… Almost"** – 3 words (or 5 emoji), 45 s, ×2. One shared
   prompt, everyone answers, everyone ranks their top two (not themselves).
7. **Podium**: top three on blocks, winner mic-drops on loop, superlatives ticker,
   Rematch (leader) or Leave. A rematch keeps the room and excludes prompts already used.

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
  counting, emoji grapheme counting, validation and scoring are literally the same
  code on both sides. The client uses it for live UX; the server for the final word.
- **No persistence.** Rooms die with the process. Session tokens are HMAC signatures of
  the player id with a per-process secret; a server restart ends all games (acceptable
  for v1, documented in [Roadmap](#roadmap--known-gaps)).
- **One static bundle.** Express serves the built client from `client/dist` and upgrades
  `/ws` to WebSocket on the same port. Caddy terminates TLS in front.

| Layer    | Choice                                                                      | Why                                                                                                      |
| -------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Client   | React 19 + Vite 6, plain CSS                                                | No canvas engine needed; SVG + CSS keyframes animate the characters                                      |
| Realtime | native `ws` (server) / browser `WebSocket`                                  | JSON `{type, payload}` messages exactly as the spec's protocol table; socket.io's extras were not needed |
| Server   | Node 22+, TypeScript, Express 5                                             | Express only serves static files and `/healthz`                                                          |
| Tests    | Vitest (unit + state machine with fake timers), Playwright (3-phone e2e)    |                                                                                                          |
| Fonts    | `@fontsource-variable/fredoka` (display), `@fontsource/nunito` (body)       | Self-hosted, OFL licensed; no runtime dependency on Google Fonts                                         |
| Sounds   | WebAudio synthesis in `client/src/audio/`                                   | Ships no audio assets; per-phase procedural music plus typewriter, mic drop, roast, win/lose effects     |
| Deploy   | Docker multi-stage image + Caddy (auto Let's Encrypt) on an Ubuntu 24.04 VM | See [Hosting](#hosting-on-cybera)                                                                        |

---

## Repository layout

```
say-less/
├── shared/src/            Rules shared by client and server (no runtime deps)
│   ├── constants.ts       Round table (limits, timers, multipliers), point values, holds/TTLs
│   ├── types.ts           Public state shapes the server broadcasts and the client renders
│   ├── protocol.ts        Client→server and server→client message unions, error codes
│   ├── words.ts           Word counting, emoji grapheme counting, validateAnswer()
│   ├── scoring.ts         scoreMatchup(), scoreFinal(), computePlacements(), roundTo5()
│   ├── superlatives.ts    Podium superlatives
│   ├── characters.ts      Roster metadata (id, name, flavor, accent color)
│   └── profanity.ts       Display-only masking word list
├── shared/test/           Unit tests for the rules incl. the spec's worked examples
├── server/src/
│   ├── index.ts           HTTP + WS entrypoint, static serving, /healthz, graceful shutdown
│   ├── room.ts            THE state machine: one class per room (~1000 lines, read this first)
│   ├── roomManager.ts     Room registry, code generation, empty-room expiry
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
│   ├── src/components/    Character, TimerRing, LimitChips, WordInput, AnswerText, PlayerChip, Header
│   ├── src/screens/       Home, Lobby, CharSelect, RoundIntro, Writing, Voting, MatchupReveal, RoundResults, FinalVoting, Podium
│   ├── src/styles/        global.css (tokens, palettes, no-select), characters.css (5 states), screens.css
│   ├── src/characters/svg Ten placeholder SVGs following the group contract in its README.md
│   ├── src/audio/         Synthesized music (sequencer, songs) and sound effects
│   └── public/sprites/    Optional PNG sprite overrides + manifest.json (see ASSETS.md)
├── content/prompts.json   373 prompts tagged by round
├── e2e/full-game.spec.ts  Playwright: three phone browsers play a whole game
├── deploy/                Dockerfile, docker-compose.yml, Caddyfile, cloud-init.yaml, provision.sh, deploy.sh
├── cloud/                 OpenStack CLI wrapper + credential bootstrap (secrets gitignored under cloud/secrets/)
├── tools/dechroma.py      Magenta → transparent sprite converter (uv run)
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

- `shared/test/scoring.test.ts` – both worked examples from the spec (900 points with Mic
  Drop; roast backfire steal), Silenced min-2-votes rule, tie split, abstain → 0, no Mic
  Drop for an auto-submitted "…", Great Minds, final top-2 scoring, shared placements.
- `shared/test/words.test.ts` – hyphen/apostrophe counting, punctuation-only tokens,
  120-char cap, roasted limit of 2, emoji graphemes (flags, ZWJ families, skin tones
  count as 1; letters and digits rejected; keycaps accepted).
- `server/test/room.game.test.ts` – a scripted 3-player game LOBBY → PODIUM whose final
  scores (2300 / 850 / 400) are hand-computed in the file header; matchup generation
  invariants for 5 players.
- `server/test/room.rules.test.ts` – redaction per phase, over-limit rejection,
  auto-submit texts, Great Minds, character race, timer-expiry assignment, roast window
  rules and a deterministic backfire steal (5 players), leader hand-off, reconnect
  re-sends prompts, lobby slot expiry, duplicate names, room full / mid-game join.
- `e2e/full-game.spec.ts` – three iPhone-sized Chromium contexts: create/join, settings,
  character race, refresh during writing lands back on the prompt, roast overlay and
  2-word counter, all votes, final card wall, podium with "Most Mic Drops", rematch
  returns to the same room code, and a check that the painted sprites are animating.
  Screenshots per phase land in `e2e/shots/` (gitignored).
- `e2e/twelve-players.spec.ts` – twelve contexts play a full game; every player's round
  change must equal the sum of their reveal deltas, the final points and podium totals
  must reconcile, and a 13th phone is turned away.
- `e2e/devices.spec.ts` – home to first answer on each device project; `e2e/helpers.ts`
  records layout issues (overflow, clipped text, small tap targets, low contrast, blank
  space) per screenshot into `layout-issues.json` without failing the run.
- `client/test/` – the base-path prefix on UI images, song data, sound settings and the
  sound controls.
- `e2e/resilience.spec.ts` (~3.3 min) – reload and double-tap in every phase with 150 ms of
  relay latency, offline 40 s mid-write and backgrounded 60 s, two tabs on one session,
  double-tapped Create Room, rejected submits and a wrong room code, clocks 90 s off, and a
  server restart mid-game (starts its own server on port 8093).
- `server/test/roomManager.test.ts`, `clientAddress.test.ts` – per-client room limits and
  which peer's X-Forwarded-For is trusted.

CI (`.github/workflows/ci.yml`) runs all of the above plus a Docker build that boots the
image and curls `/healthz`.

---

## Game rules as implemented

Source of truth: `shared/src/constants.ts` and `shared/src/scoring.ts`.

### Rounds

| Round     | Name                | Limit              | Writing timer                                         | Multiplier |
| --------- | ------------------- | ------------------ | ----------------------------------------------------- | ---------- |
| 1         | Say Some            | 12 words           | 90 s                                                  | ×1         |
| 2         | Say Less            | 6 words            | 60 s (first 10 s = roast window, prompts dealt after) | ×1.5       |
| 3 (final) | Say Nothing… Almost | 3 words or 5 emoji | 45 s                                                  | ×2         |

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
6. Emoji mode: graphemes via `Intl.Segmenter`; a grapheme counts if it contains an
   Extended_Pictographic or Regional_Indicator or a keycap; any letter → `invalid_chars`;
   digits only allowed inside keycap sequences; whitespace ignored; max 5.
7. A roasted answer has `effectiveLimit = 2` with the same rules.

Empty on timer: connected players auto-submit "…" (`autoSubmitted: true`, wordCount 0);
disconnected players get "[left the chat]".

### Scoring (all points × round multiplier, rounded to nearest 5)

| Event                 | Points           | Condition                                                                                                                           |
| --------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Vote received (R1–R2) | 100 per vote     |                                                                                                                                     |
| Silenced!             | +250             | Winner took 100 % of votes cast, at least 2 votes                                                                                   |
| Mic Drop              | +200             | Winner's word count ≤ floor(effectiveLimit / 2), at least 1 word, not auto-submitted                                                |
| Roast backfire        | steal            | Roasted player wins **and** the roaster is the opponent in that matchup → the roaster's points from that matchup move to the winner |
| Great Minds           | flat 100 each    | Both answers normalize to the same text (case, punctuation, spacing ignored); no votes counted, no other bonuses                    |
| Tie                   | vote points only | Nobody wins, no bonuses                                                                                                             |
| All abstain           | 0 / 0            |                                                                                                                                     |
| Final 1st-choice vote | 200              |                                                                                                                                     |
| Final 2nd-choice vote | 100              |                                                                                                                                     |

Podium ties share a place (1, 1, 3). Superlatives: Most Mic Drops, Wordiest Loser (words
per point among non-winners), Roast Victim, The Silencer, Fastest Submitter.

### Matchups

Custom mode: all unused custom prompts are matched to pairs that do not include their
author (maximum bipartite matching), leftover pairs take any other unused custom prompt,
then the bank fills the rest, so nobody answers their own prompt whenever that is
possible. The final-round prompt always comes from the bank, since everyone answers it.

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
- `settings.roasts = false` (lobby toggle, default on) skips the window entirely.
- Unused tokens are worthless at the podium.

### Emoji final

`settings.emojiFinal` is `off | always` (default `off`). The round intro shows "5 emoji"
tiles when active.

---

## State machine and timers

```
LOBBY ─start(leader, ≥3; unpicked get random characters)─▶ ROUND_INTRO (4s)
  ▲                                                             │
  │                        ┌────────────────────────────────────┘
  │                        ▼
  │   rounds 1–2:   WRITING (90/60s) ─all in / timer─▶ VOTING (20s) ─▶ MATCHUP_REVEAL (6s) ─┐
  │                                                        ▲                                │
  │                                                        └── next matchup ────────────────┤
  │                                                                                         ▼
  │                                                                          ROUND_RESULTS (8s)
  │                                                                                         │
  │   round 3:      ROUND_INTRO (4s) ─▶ FINAL_WRITING (45s) ─▶ FINAL_VOTING (25s) ─▶ PODIUM │
  │                                                                              │          │
  └────────────────────────── rematch(leader) ───────────────────────────────────┘◀─────────┘
```

Every phase with a timer schedules a single `setTimeout` in `Room.enterPhase`; early
completion (everyone submitted / voted) clears it and advances. The roast window is a
second timer inside WRITING. A matchup with no eligible connected voters reveals
immediately. `Room` uses the global clock so tests drive it with Vitest fake timers.

---

## WebSocket protocol

Endpoint: `/ws`. Frames are JSON `{ "type": string, "payload": object }`.
Max frame 8 KiB (server) / 4 KiB parse guard. Rate limit: one intent per 250 ms per
socket (`rate_limited`); the client paces its own sends to that gap so a double-tap is
delayed, not dropped. `ping` is exempt.

Client → server: `create_room {name}`, `join_room {code, name, sessionToken?}`,
`update_settings {profanityFilter?, emojiFinal?, promptMode?}` (leader, LOBBY),
`add_prompt {text}` / `remove_prompt {promptId}` (LOBBY; authors or the leader remove), `start_game {}`
(leader, LOBBY, ≥3), `pick_character {characterId}` (LOBBY), `spend_roast
{targetId}` (WRITING, round 2, first 10 s), `submit_answer {promptId, text}`
(WRITING/FINAL_WRITING), `cast_vote {matchupIndex, answerIndex}` (VOTING),
`cast_final_votes {first, second}` (FINAL_VOTING), `rematch {}` (leader, PODIUM),
`leave_room {}`, `ping {}`.

Server → client: `welcome {playerId, sessionToken, code}`, `room_state <PublicRoomState>`
(on every mutation), `your_prompts {prompts: [{promptId, text, effectiveLimit, mode,
matchupIndex, submittedText}]}` (private; at deal time, after each accepted submission,
and on reconnect), `roasted {byName}` (private), `reveal {matchupIndex}`, `error {code,
message}`, `left {}`, `pong {serverTime}`.

Error codes: `over_limit, already_roasted, char_taken, bad_phase, room_full, not_found,
rate_limited, invalid, not_leader, bad_name, not_enough_players, too_long,
invalid_chars, empty, self_target, no_token, already_submitted`.

`PublicRoomState` (see `shared/src/types.ts`) carries: code, phase, `phaseEndsAt`,
`phaseStartedAt`, `serverNow`, roundIndex, players (public fields only), leaderId,
settings, `customPrompts` (id, text, authorId), matchups (redacted, see below), currentMatchupIndex, `roastWindowEndsAt`,
`submittedIds`, `votedIds`, `final` (prompt, mode, limit, answers, votes, result),
`podium`, `banner`, `gamesPlayed`.

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
| Final individual votes                            | PODIUM                                                                            |
| Another player's prompts                          | never sent                                                                        |

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
- **Character component** renders the painted WebP sprite for every character/state
  listed in `client/public/sprites/manifest.json` (all of them today) and falls back to
  the inline SVG; `characters.css` animates either. The full-game test fails if a sprite
  is not animating.
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

---

## Characters and art pipeline

Roster and accent colors: `shared/src/characters.ts`. Placeholder art:
`client/src/characters/svg/*.svg`, drawn to a strict group contract
(`c-shadow, c-body > c-face > c-eyes/c-mouth, c-arm-l, c-arm-r, c-pencil,
c-sweat, c-gag`) so CSS can pose them: idle breathe, writing scribble + pencil + sweat,
waiting glance, win arm-up + bounce, lose deflate with per-character gags
(rabbit ears and axolotl gills droop, blob puddles, fish blows bubbles, bird head-bobs).

The roster is the Reel Town cast (cat, monkey, bird, axolotl, bear, rabbit, fish, blob)
plus duck, otter, penguin and hedgehog, so most of the animals appear in both games. The
duck replaced the Reel Town frog; only the How to play "gather" picture still shows the
frog (the share card was recast with the cat, monkey, bird and rabbit). Twelve
characters because the room holds twelve players and every player needs a unique one.
Every character and pose now has painted art, so the SVGs are only a fallback for a pose
missing from `client/public/sprites/manifest.json`. Raster sprites are animated as a whole
(`.char-sprite img` in `characters.css`) since they have no named groups. UI images render
through `client/src/components/UIArt.tsx`, which crops each one to its painted bounds from
`client/public/ui/manifest.json` and prefixes `import.meta.env.BASE_URL` so the same build
works at the domain root (Cybera) and under `/say-less/` (GitHub Pages).

To change art, follow `ASSETS.md` (filenames, sizes, prompts, **magenta #FF00FF
background**), drop files under `art/raw/`, then:

```bash
uv run tools/dechroma.py
```

This keys out the magenta, despills edges, cuts sheets into cells, trims, squares, resizes
to 512 and writes WebP (quality 88, about a fifth of the PNG size: 2.2 MB for all 83
images instead of 12 MB) plus both manifests. Commit the outputs under `client/public/`; the whole
`art/` folder is gitignored.

**Art provenance.** Generated on 2026-09-24 with ChatGPT's built-in image tool from the
prompts in `ASSETS.md`, using the two Reel Town reference sheets. Sheets came back at
1254 x 1254 rather than the requested 2048 (podium 1774 x 887, share card 1536 x 1024);
cells are enlarged slightly on the 512 export. Revisions on 2026-09-25: new faces for the
bear, bird, blob and monkey `waiting` poses (the bird had grown a human mouth under its
beak; the others had zigzag grimaces) and a recast share card (cat, monkey, bird, rabbit).
The originals of those five are kept locally in `art/raw/revisions-before/`, and the edit
prompts in `art/revision-prompts.json`. `art/raw/final/icon-rounded-original.png` is not
used: the generator punched blotchy transparent holes through its background, so the
opaque icon supplies every icon size.

---

## Prompt bank

`content/prompts.json`: 373 prompts, `{ id, text, rounds }` where `rounds ⊆ [0,1,2]`.
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

Health: `curl -6 https://38dcd.yeg.rac.sh/healthz` → `{"ok":true,"rooms":N,"prompts":373}`.

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

| Spec                                          | Implemented                                                                                                                                      | Why                                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ROUND_RESULTS → FINAL_WRITING` directly      | `ROUND_RESULTS → ROUND_INTRO → FINAL_WRITING`                                                                                                    | The shattering 6 → 3 tiles is the signature motif; skipping it for the final felt wrong. 4 s cost.                                       |
| `settings.emojiFinal: boolean`                | `'off' \| 'always'`, default off; no 30 % random mode                                                                                            | The spec says both "30 % probability" and "or always, via settings"; a tri-state expresses both.                                         |
| Final voting anonymity unspecified            | Authors visible on the final card wall                                                                                                           | `cast_final_votes` is keyed by player id per the spec's protocol; matchup voting stays anonymous.                                        |
| Mic Drop: "≤ half the limit and won"          | additionally requires ≥ 1 word and not auto-submitted                                                                                            | Otherwise a winning "…" (0 words) would earn a Mic Drop.                                                                                 |
| `stats: {micDrops, silenced, wordsUsedTotal}` | plus `roasted, submissions, submitMsTotal`                                                                                                       | Needed for the Roast Victim and Fastest Submitter superlatives.                                                                          |
| Error codes list                              | plus `rate_limited, invalid, not_leader, bad_name, not_enough_players, too_long, invalid_chars, empty, self_target, no_token, already_submitted` | Distinct client messages.                                                                                                                |
| Profanity masking "in displayed answers only" | done on the client from the shared list                                                                                                          | Keeps one broadcast per mutation instead of per-player payloads; the author is identified by comparing against their own submitted text. |
| Roast window "R2+"                            | round 2 only                                                                                                                                     | The spec's protocol table says `spend_roast` is valid in `WRITING` only, and the final has no matchups for the backfire rule.            |
| Disconnected mid-write → "[left the chat]"    | applied at phase end, not at disconnect                                                                                                          | Lets a quick reconnect still answer.                                                                                                     |
| Sounds: "typewriter, mic drop, roast sting"   | synthesized with WebAudio                                                                                                                        | No asset licensing; swap for samples later if wanted.                                                                                    |
| Characters: hand-built SVG                    | placeholder SVGs drawn by the agent; raster override pipeline                                                                                    | User is generating final art in ChatGPT; see `ASSETS.md`.                                                                                |

Nothing in the spec's _locked decisions_ was changed: fully online, player voting only,
flat-vector art direction, one unique character per player.

---

## Decisions log

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

- **Core art is complete.** All 60 poses, 23 UI images, app icons and share card are wired.
  Generation prompts and the optional background tiles and confetti are in `ASSETS.md`.
- **Manual phone test.** The e2e suite drives Chromium and desktop WebKit at phone sizes,
  up to twelve players; a real session on real phones over the public URL has not
  happened yet. That is the only way to catch iOS Safari's keyboard, audio unlock, silent
  switch and backgrounding behaviour, and to judge how a twelve-player round feels (about
  six minutes of voting per round on the current timers).
- **Listen to the music.** It was composed as data and verified by offline level renders,
  never heard. Tempo, voicing and mix may want tuning by ear (`client/src/audio/songs.ts`).
- **Known small leaks, accepted for now.** A roast-token holder can probe `spend_roast` and
  learn from `already_roasted` that a player was roasted. An answer that auto-submitted
  ("…") or "[left the chat]" hints at its author before the reveal. In emoji mode a lone
  keycap mark counts as an emoji and regional-indicator pairs can spell letters. None of
  these change scores.
- **IPv4 reachability.** See Hosting; add a Cloudflare Tunnel if friends on IPv4-only
  Wi-Fi cannot connect. The GitHub Pages front end loads over IPv4, but its WebSocket
  still goes to the IPv6-only server.
- **Server restarts kill rooms.** Rooms are in memory, so a deploy ends every game in
  progress. Persisting them (Redis or a JSON snapshot) would allow zero-downtime deploys.
- **No metrics.** `/healthz` reports room and prompt counts; there are no dashboards.
- **Spectators / audience mode, accounts, localization** – explicit non-goals for v1.

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
