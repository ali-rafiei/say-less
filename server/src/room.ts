import {
  AUTO_SUBMIT_TEXT,
  CHARACTER_IDS,
  DEFAULT_PACKS,
  DrawingError,
  DISCONNECT_GRACE_MS,
  FINAL_ROUND,
  INITIALS_LENGTHS,
  LEFT_TEXT,
  LIMITS,
  LOBBY_HOLD_MS,
  PACKS,
  PLAYER_TOKEN,
  RECONNECT_HOLD_MS,
  SITES,
  SITE_IDS,
  TIMERS,
  computePlacements,
  computeSuperlatives,
  countWords,
  decodeDrawing,
  finalRevealSchedule,
  isBlankDrawing,
  normalizeWhitespace,
  phaseClock,
  roastWindowMs,
  roundSpec,
  scoreFinal,
  scoreMatchup,
  scorePosts,
  validateAnswer,
  type CustomPrompt,
  type ErrorCode,
  type FinalTally,
  type GameLength,
  type GameMode,
  type Highlight,
  type MatchupResult,
  type PlayerStats,
  type Prompt,
  type PublicAnswer,
  type PublicMatchup,
  type PublicPlayer,
  type PublicRoomState,
  type PublicSeed,
  type Roast,
  type RoomPhase,
  type RoomSettings,
  type RoundIndex,
  type SiteId,
  type ServerMessage,
  type TimerSpeed,
  type ViewerState,
  type YourPrompt,
} from './shared.ts';
import type { PromptDeck, SeedBanks } from './prompts.ts';

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface Player {
  id: string;
  name: string;
  characterId: string | null;
  connected: boolean;
  /** seated by the server; never leads the room */
  bot: boolean;
  connectedSince: number;
  joinedAt: number;
  score: number;
  roastTokens: number;
  /** live counters; copied into `publicStats` only at round results / podium (anonymity) */
  stats: PlayerStats;
  publicStats: PlayerStats;
  publicRoastTokens: number;
  slotExpired: boolean;
  removalTimer: ReturnType<typeof setTimeout> | null;
  /** until then a disconnected player still counts as playing */
  graceEndsAt: number;
  graceTimer: ReturnType<typeof setTimeout> | null;
  /** removed by the leader mid-game: the seat stays for the matchups, the phone is shut out */
  kicked: boolean;
  /** the browser's anonymous id, for play counts; null for bots and old clients */
  deviceId: string | null;
}

/** Watches and votes; never writes, never scores. */
interface AudienceMember {
  id: string;
  name: string;
  deviceId: string | null;
  connected: boolean;
  removalTimer: ReturnType<typeof setTimeout> | null;
}

interface Answer {
  playerId: string;
  text: string;
  wordCount: number;
  autoSubmitted: boolean;
  effectiveLimit: number | null;
  bailOut: boolean;
}

interface PauseInfo {
  byName: string;
  at: number;
  remainingMs: number | null;
  roastRemainingMs: number | null;
}

/** A Doodle drawing or an Out of Context honest answer (the quote someone else twists). */
interface Seed {
  kind: 'drawing' | 'quote';
  authorId: string;
  /** the secret drawing suggestion, or the question the author answered */
  question: string;
  /** the encoded drawing, or the honest answer */
  content: string;
}

interface DealtPrompt extends Prompt {
  /** custom prompts and seeds are never dealt to their author in a matchup */
  authorId?: string;
  seed?: Seed;
  /** Out of Context: the post this prompt asks its twister to write the context for */
  post?: Post;
  /** Initials mode: each word of an answer starts with the next of these letters */
  letters?: string;
}

/** Out of Context: the victim's quote on a fake site; the twister writes what it is under. */
interface Post {
  id: string;
  victimId: string;
  twisterId: string;
  quote: string;
  site: SiteId;
}

/** A player's CREATING job for the round. */
interface Task {
  id: string;
  kind: 'draw' | 'confess';
  text: string;
}

interface Matchup {
  prompt: DealtPrompt;
  playerIds: [string, string];
  answers: [Answer | null, Answer | null];
  votes: Record<string, 0 | 1>;
  audienceVotes: Record<string, 0 | 1>;
  roast: Roast | null;
  result: MatchupResult | null;
  revealed: boolean;
}

/**
 * A wall round: everyone answers, every answer goes up on one wall. The final of Classic,
 * Custom and Doodle (one shared prompt, rank your top two), and every round of Out of
 * Context (one post each to twist, one vote).
 */
interface FinalRound {
  prompt: DealtPrompt;
  /** Out of Context only */
  posts: Post[] | null;
  playerIds: string[];
  limit: number | null;
  answers: Map<string, Answer>;
  /** rank: [first, second] player ids. Out of Context: [post id, ''] */
  votes: Record<string, [string, string]>;
  /** audience id -> player id (rank) or post id (Out of Context) */
  audienceVotes: Record<string, string>;
  /** anonymous rank finals: player id -> the opaque id the wall shows instead */
  anonIds: Map<string, string> | null;
  result: Record<string, FinalTally> | null;
}

/** What a victim who wrote nothing in time is quoted as. */
const NO_COMMENT = 'No comment.';

const FALLBACK_SEEDS: SeedBanks = {
  doodles: ['A cat with a secret', 'Your dream vacation', 'A very tired robot'],
  questions: ['What did you have for breakfast?', 'What is your favorite snack?'],
};

const DRAWING_PROMPT_TEXT = 'Caption this masterpiece.';

const FALLBACK_BAIL_OUTS = ['Pass', 'No comment', 'Big if true', 'Ask my lawyer'];

/** Initials letters, weighted toward common first letters; no Q, X or Z. */
const INITIAL_POOL = 'AAABBBBCCCCDDDEEFFFGGGHHHIIJJKLLLMMMMNNOOPPPPRRRSSSSSTTTTTUVWWWY';

/** What the room tells the play counter. */
export type GameEvent =
  { type: 'started'; deviceIds: string[]; seats: number } | { type: 'finished' };

export interface RoomDeps {
  deck: PromptDeck;
  seedBanks?: SeedBanks;
  /** stock answers for Bail Out */
  bailOuts?: readonly string[];
  send: (playerId: string, message: ServerMessage) => void;
  random?: () => number;
  onEmpty?: (room: Room) => void;
  onGameEvent?: (event: GameEvent) => void;
}

function freshStats(): PlayerStats {
  return {
    votesReceived: 0,
    roasted: 0,
    wordsUsedTotal: 0,
    submissions: 0,
    submitMsTotal: 0,
  };
}

function cleanText(raw: string): string {
  return normalizeWhitespace(normalizeWhitespace(raw).replace(/\p{C}/gu, ''));
}

export function sanitizeName(raw: string): string {
  return Array.from(cleanText(raw)).slice(0, LIMITS.NAME_MAX).join('').trim();
}

export class Room {
  phase: RoomPhase = 'LOBBY';
  phaseEndsAt: number | null = null;
  phaseStartedAt: number;
  roundIndex: RoundIndex = 0;
  leaderId = '';
  settings: RoomSettings = {
    profanityFilter: false,
    wordLimits: true,
    mode: 'classic',
    packs: [...DEFAULT_PACKS],
    roasts: false,
    timers: 'normal',
    bailOuts: true,
    audience: true,
    maxPlayers: LIMITS.MAX_PLAYERS,
    length: 'full',
    anonymousFinal: false,
  };
  gamesPlayed = 0;
  banner: string | null = null;

  readonly players: Player[] = [];
  private readonly audience = new Map<string, AudienceMember>();
  private pause: PauseInfo | null = null;
  private highlights: Highlight[] = [];
  private readonly usedBailOuts = new Set<string>();
  private customPrompts: CustomPrompt[] = [];
  private customPromptSeq = 0;
  private matchups: Matchup[] = [];
  private currentMatchupIndex = 0;
  private final: FinalRound | null = null;
  private podium: PublicRoomState['podium'] = null;
  private roastWindowEndsAt: number | null = null;
  private promptsDealt = false;
  private promptsDealtAt = 0;
  private readonly usedPromptIds = new Set<string>();
  private tasks = new Map<string, Task>();
  private seeds = new Map<string, Seed>();
  private seedSeq = 0;
  /** this game's seeded prompts with their vote totals; the final replays the favourite */
  private encore: { prompt: DealtPrompt; votes: number }[] = [];
  private readonly drawings = new Map<string, string>();
  private readonly sentDrawings = new Map<string, Set<string>>();
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private roastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly random: () => number;
  private closed = false;

  constructor(
    readonly code: string,
    private readonly deps: RoomDeps,
  ) {
    this.random = deps.random ?? Math.random;
    this.phaseStartedAt = Date.now();
  }

  // ---------------------------------------------------------------- lifecycle

  get connectedCount(): number {
    return this.players.filter((p) => p.connected).length;
  }

  /** Bots never disconnect, so this is what decides whether a room is empty. */
  get connectedHumans(): number {
    return this.players.filter((p) => p.connected && !p.bot).length;
  }

  get connectedAudience(): number {
    return [...this.audience.values()].filter((m) => m.connected).length;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** Anyone who may hold this room's seat or audience spot (a kicked player may not). */
  hasPlayer(playerId: string): boolean {
    return this.players.some((p) => p.id === playerId && !p.kicked) || this.audience.has(playerId);
  }

  get isPaused(): boolean {
    return this.pause !== null;
  }

  close(): void {
    this.closed = true;
    this.clearTimer();
    if (this.roastTimer) clearTimeout(this.roastTimer);
    for (const player of this.players) {
      if (player.removalTimer) clearTimeout(player.removalTimer);
      if (player.graceTimer) clearTimeout(player.graceTimer);
    }
    for (const member of this.audience.values()) {
      if (member.removalTimer) clearTimeout(member.removalTimer);
    }
  }

  // ------------------------------------------------------------- join / leave

  /** Seats a player in the lobby; a game in progress or a full room puts them in the audience. */
  addPlayer(
    playerId: string,
    rawName: string,
    bot = false,
    deviceId: string | null = null,
  ): 'player' | 'audience' {
    const seated = this.phase === 'LOBBY' && this.players.length < this.settings.maxPlayers;
    if (!seated && (bot || !this.settings.audience)) {
      if (this.phase !== 'LOBBY')
        throw new RoomError('bad_phase', 'That game is already in progress');
      throw new RoomError('room_full', 'Room is full');
    }
    if (!seated && this.audience.size >= LIMITS.MAX_AUDIENCE)
      throw new RoomError('room_full', 'The audience is full');
    const name = this.uniqueName(sanitizeName(rawName));
    if (name.length === 0)
      throw new RoomError('bad_name', 'Pick a name between 1 and 12 characters');
    if (!seated) {
      this.audience.set(playerId, {
        id: playerId,
        name,
        deviceId,
        connected: true,
        removalTimer: null,
      });
      this.broadcast();
      return 'audience';
    }
    this.seat(playerId, name, bot, deviceId);
    return 'player';
  }

  private seat(playerId: string, name: string, bot: boolean, deviceId: string | null): void {
    const now = Date.now();
    this.players.push({
      id: playerId,
      name,
      characterId: null,
      connected: true,
      bot,
      connectedSince: now,
      joinedAt: now,
      score: 0,
      roastTokens: LIMITS.ROAST_TOKENS_PER_GAME,
      stats: freshStats(),
      publicStats: freshStats(),
      publicRoastTokens: LIMITS.ROAST_TOKENS_PER_GAME,
      slotExpired: false,
      removalTimer: null,
      graceEndsAt: 0,
      graceTimer: null,
      kicked: false,
      deviceId,
    });
    if (!this.leaderId && !bot) this.leaderId = playerId;
    this.broadcast();
  }

  /** In the lobby, waiting audience members take any free seats, first come first served. */
  private fillSeatsFromAudience(): void {
    if (this.phase !== 'LOBBY') return;
    for (const member of [...this.audience.values()]) {
      if (this.players.length >= this.settings.maxPlayers) return;
      if (!member.connected) continue;
      this.audience.delete(member.id);
      if (member.removalTimer) clearTimeout(member.removalTimer);
      this.seat(member.id, member.name, false, member.deviceId);
      if (!this.players.some((p) => p.id === this.leaderId && p.connected))
        this.leaderId = member.id;
    }
  }

  /** Re-attach a returning player (their id was proven by a session token). */
  reconnect(playerId: string, deviceId: string | null = null): void {
    const member = this.audience.get(playerId);
    if (member) {
      member.deviceId ??= deviceId;
      if (member.removalTimer) clearTimeout(member.removalTimer);
      member.removalTimer = null;
      member.connected = true;
      this.sentDrawings.delete(playerId);
      this.broadcast();
      return;
    }
    const player = this.requirePlayer(playerId);
    player.deviceId ??= deviceId;
    if (player.removalTimer) {
      clearTimeout(player.removalTimer);
      player.removalTimer = null;
    }
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    const wasConnected = player.connected;
    // A fresh page has an empty drawing cache.
    this.sentDrawings.delete(playerId);
    player.connected = true;
    player.slotExpired = false;
    player.graceEndsAt = 0;
    if (!wasConnected) player.connectedSince = Date.now();
    const leader = this.players.find((p) => p.id === this.leaderId);
    if (!leader || !leader.connected || leader.bot) {
      this.leaderId = playerId;
      this.banner = `${player.name} is now the leader`;
    }
    this.broadcast();
    this.sendPrivateState(playerId);
  }

  disconnect(playerId: string, withGrace = true): void {
    const member = this.audience.get(playerId);
    if (member) {
      if (!member.connected) return;
      member.connected = false;
      member.removalTimer = setTimeout(() => {
        this.audience.delete(playerId);
        this.broadcast();
      }, RECONNECT_HOLD_MS);
      this.broadcast();
      return;
    }
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.connected) return;
    player.connected = false;
    const hold = this.phase === 'LOBBY' ? LOBBY_HOLD_MS : RECONNECT_HOLD_MS;
    player.removalTimer = setTimeout(() => this.expireSlot(playerId), hold);
    if (withGrace) {
      // A leader whose page reloads keeps the Start button; it moves only if they stay gone.
      player.graceEndsAt = Date.now() + DISCONNECT_GRACE_MS;
      player.graceTimer = setTimeout(() => {
        player.graceTimer = null;
        if (this.leaderId === playerId && !player.connected) {
          this.passLeadership();
          this.broadcast();
        }
        this.afterPresenceChange();
      }, DISCONNECT_GRACE_MS);
    } else if (this.leaderId === playerId) {
      this.passLeadership();
    }
    this.afterPresenceChange();
    this.broadcast();
    if (this.connectedHumans === 0) this.deps.onEmpty?.(this);
  }

  leave(playerId: string): void {
    const member = this.audience.get(playerId);
    if (member) {
      if (member.removalTimer) clearTimeout(member.removalTimer);
      this.audience.delete(playerId);
      this.broadcast();
      return;
    }
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;
    if (this.phase === 'LOBBY' || this.phase === 'PODIUM') {
      this.removePlayer(playerId);
    } else {
      this.disconnect(playerId, false);
    }
    if (this.connectedHumans === 0) this.deps.onEmpty?.(this);
  }

  private expireSlot(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.connected) return;
    player.removalTimer = null;
    if (this.phase === 'LOBBY' || this.phase === 'PODIUM') {
      this.removePlayer(playerId);
      return;
    }
    // Mid-game the seat must stay (matchups reference it); drop it at the podium.
    player.slotExpired = true;
    if (this.leaderId === playerId) {
      this.passLeadership();
      this.broadcast();
    }
  }

  private dropExpiredSlots(): void {
    for (const player of [...this.players]) {
      if (player.slotExpired && !player.connected) this.removePlayer(player.id);
    }
  }

  private removePlayer(playerId: string): void {
    const index = this.players.findIndex((p) => p.id === playerId);
    if (index === -1) return;
    const [player] = this.players.splice(index, 1);
    if (player?.removalTimer) clearTimeout(player.removalTimer);
    if (player?.graceTimer) clearTimeout(player.graceTimer);
    if (this.leaderId === playerId) this.passLeadership();
    this.fillSeatsFromAudience();
    this.broadcast();
  }

  private passLeadership(): void {
    const others = this.players.filter((p) => !p.bot && p.id !== this.leaderId);
    const candidates = others
      .filter((p) => p.connected)
      .sort((a, b) => a.connectedSince - b.connectedSince);
    const next = candidates[0] ?? others[0] ?? null;
    if (!next) {
      this.leaderId = this.players.find((p) => !p.bot)?.id ?? '';
      return;
    }
    this.leaderId = next.id;
    this.banner = `${next.name} is now the leader`;
  }

  private uniqueName(base: string): string {
    if (base.length === 0) return base;
    const taken = new Set(
      [...this.players, ...this.audience.values()].map((p) => p.name.toLowerCase()),
    );
    if (!taken.has(base.toLowerCase())) return base;
    for (let n = 2; n < 100; n++) {
      const suffix = ` (${n})`;
      const candidate =
        Array.from(base)
          .slice(0, LIMITS.NAME_MAX - suffix.length)
          .join('')
          .trimEnd() + suffix;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    throw new RoomError('bad_name', 'Too many players share that name');
  }

  // ----------------------------------------------------------------- intents

  updateSettings(playerId: string, patch: Partial<RoomSettings>): void {
    this.requirePhase('LOBBY');
    this.requireLeader(playerId);
    if (typeof patch.profanityFilter === 'boolean')
      this.settings.profanityFilter = patch.profanityFilter;
    if (typeof patch.wordLimits === 'boolean') this.settings.wordLimits = patch.wordLimits;
    if (typeof patch.roasts === 'boolean') this.settings.roasts = patch.roasts;
    if (isGameMode(patch.mode)) this.settings.mode = patch.mode;
    if (isTimerSpeed(patch.timers)) this.settings.timers = patch.timers;
    if (typeof patch.bailOuts === 'boolean') this.settings.bailOuts = patch.bailOuts;
    if (typeof patch.audience === 'boolean') this.settings.audience = patch.audience;
    if (typeof patch.anonymousFinal === 'boolean')
      this.settings.anonymousFinal = patch.anonymousFinal;
    if (isGameLength(patch.length)) this.settings.length = patch.length;
    if (patch.maxPlayers !== undefined) {
      const max = Number(patch.maxPlayers);
      if (!Number.isInteger(max) || max < LIMITS.MIN_PLAYERS || max > LIMITS.MAX_PLAYERS)
        throw new RoomError(
          'invalid',
          `Seats go from ${LIMITS.MIN_PLAYERS} to ${LIMITS.MAX_PLAYERS}`,
        );
      // Lowering it never unseats anyone; it only stops new players taking seats.
      this.settings.maxPlayers = max;
      this.fillSeatsFromAudience();
    }
    if (Array.isArray(patch.packs)) {
      const packs = PACKS.map((p) => p.id).filter((id) => (patch.packs as unknown[]).includes(id));
      if (packs.length === 0) throw new RoomError('invalid', 'Pick at least one pack');
      this.settings.packs = packs;
    }
    this.broadcast();
  }

  /** Any player may add prompts in the lobby; they are dealt first in custom mode. */
  addPrompt(playerId: string, rawText: string): void {
    this.requirePhase('LOBBY');
    this.requireActor(playerId);
    const text = cleanText(rawText);
    if (text.length < 3) throw new RoomError('empty', 'Write a prompt first');
    if (text.length > LIMITS.PROMPT_MAX_CHARS) {
      throw new RoomError('too_long', `Keep prompts under ${LIMITS.PROMPT_MAX_CHARS} characters`);
    }
    if (this.customPrompts.length >= LIMITS.MAX_CUSTOM_PROMPTS) {
      throw new RoomError('invalid', `That's plenty: ${LIMITS.MAX_CUSTOM_PROMPTS} prompts max`);
    }
    if (this.customPrompts.some((p) => p.text.toLowerCase() === text.toLowerCase())) {
      throw new RoomError('invalid', 'Someone already added that prompt');
    }
    this.customPromptSeq += 1;
    this.customPrompts.push({ id: `c${this.customPromptSeq}`, text, authorId: playerId });
    this.broadcast();
  }

  /** Authors remove their own prompts; the leader can remove any. */
  removePrompt(playerId: string, promptId: string): void {
    this.requirePhase('LOBBY');
    this.requireActor(playerId);
    const prompt = this.customPrompts.find((p) => p.id === promptId);
    if (!prompt) throw new RoomError('not_found', 'That prompt is gone');
    if (prompt.authorId !== playerId && this.leaderId !== playerId) {
      throw new RoomError('not_leader', 'Only the author or the leader can remove it');
    }
    this.customPrompts = this.customPrompts.filter((p) => p.id !== promptId);
    this.broadcast();
  }

  startGame(playerId: string): void {
    this.requirePhase('LOBBY');
    this.requireLeader(playerId);
    if (this.connectedCount < LIMITS.MIN_PLAYERS) {
      throw new RoomError('not_enough_players', `Need at least ${LIMITS.MIN_PLAYERS} players`);
    }
    for (const player of [...this.players]) {
      if (!player.connected) this.removePlayer(player.id);
    }
    this.banner = null;
    for (const player of this.players) {
      player.score = 0;
      player.roastTokens = LIMITS.ROAST_TOKENS_PER_GAME;
      player.publicRoastTokens = LIMITS.ROAST_TOKENS_PER_GAME;
      player.stats = freshStats();
      player.publicStats = freshStats();
    }
    this.podium = null;
    this.final = null;
    this.matchups = [];
    this.encore = [];
    this.highlights = [];
    // Characters are picked in the lobby; anyone who did not pick gets a random leftover.
    this.assignMissingCharacters();
    const humans = this.players.filter((p) => !p.bot);
    this.deps.onGameEvent?.({
      type: 'started',
      deviceIds: humans.flatMap((p) => (p.deviceId ? [p.deviceId] : [])),
      seats: humans.length,
    });
    this.beginRound(0);
  }

  /** Lobby pick, first come first served; picking again swaps to the new character. */
  pickCharacter(playerId: string, characterId: string): void {
    this.requirePhase('LOBBY');
    const player = this.requireActor(playerId);
    if (!CHARACTER_IDS.includes(characterId)) throw new RoomError('invalid', 'Unknown character');
    const owner = this.players.find((p) => p.characterId === characterId);
    if (owner && owner.id !== playerId)
      throw new RoomError('char_taken', 'Someone grabbed that one first');
    player.characterId = characterId;
    this.broadcast();
  }

  spendRoast(playerId: string, targetId: string): void {
    this.requirePhase('WRITING');
    this.requireUnpaused();
    const spender = this.requireActor(playerId);
    if (this.roundIndex < LIMITS.ROAST_FROM_ROUND)
      throw new RoomError('bad_phase', 'Roasts unlock in round 2');
    if (this.roastWindowEndsAt === null || Date.now() >= this.roastWindowEndsAt) {
      throw new RoomError('bad_phase', 'The roast window has closed');
    }
    if (spender.roastTokens <= 0)
      throw new RoomError('invalid', 'You already spent your roast token');
    if (targetId === playerId) throw new RoomError('self_target', 'You cannot roast yourself');
    const target = this.requirePlayer(targetId);
    if (this.matchups.some((m) => m.roast?.targetId === targetId)) {
      throw new RoomError('already_roasted', `${target.name} has already been roasted this round`);
    }
    if (!this.matchups.some((m) => m.playerIds.includes(targetId))) {
      throw new RoomError('invalid', 'That player has no prompt this round');
    }
    if (!this.placeRoast({ spenderId: playerId, targetId }, new Set())) {
      throw new Error(`No matchup can take a roast on ${targetId}`);
    }
    spender.roastTokens -= 1;
    // Nothing public changes until the reveal: a visible token drop would name the target.
    this.sendPrivateState(playerId);
    this.deps.send(targetId, { type: 'roasted', payload: { byName: spender.name } });
  }

  submitAnswer(playerId: string, promptId: string, rawText: string): void {
    this.requireUnpaused();
    const player = this.requireActor(playerId);
    if (this.phase === 'CREATING') {
      const task = this.requireTask(playerId, promptId, 'confess');
      const validation = validateAnswer(cleanText(rawText), LIMITS.CONFESSION_WORDS);
      if (!validation.ok) {
        throw new RoomError(
          validation.error ?? 'invalid',
          validation.error === 'over_limit'
            ? `Keep it to ${LIMITS.CONFESSION_WORDS} words`
            : 'Tell us something. Anything.',
        );
      }
      this.addSeed(player, task, 'quote', validation.text);
      return;
    }
    this.acceptAnswer(player, promptId, (limit, letters) =>
      this.buildAnswer(player, rawText, limit, letters),
    );
  }

  /** Answers with a stock phrase that fits the prompt's limit, worth half the vote points. */
  bailOut(playerId: string, promptId: string): void {
    this.requireUnpaused();
    const player = this.requireActor(playerId);
    if (!this.settings.bailOuts) throw new RoomError('invalid', 'Bail Outs are off in this room');
    if (this.settings.mode === 'initials')
      throw new RoomError('invalid', 'No Bail Outs in Initials: the letters are the challenge');
    this.acceptAnswer(player, promptId, (limit) => {
      const answer = this.buildAnswer(player, this.pickBailOut(limit), limit, null);
      answer.bailOut = true;
      return answer;
    });
  }

  /** Writing and final writing: files a player's answer to one of their prompts. */
  private acceptAnswer(
    player: Player,
    promptId: string,
    build: (limit: number | null, letters: string | null) => Answer,
  ): void {
    const playerId = player.id;
    if (this.phase === 'WRITING') {
      if (!this.promptsDealt) throw new RoomError('bad_phase', 'Prompts have not been dealt yet');
      const index = this.matchups.findIndex(
        (m) => m.prompt.id === promptId && m.playerIds.includes(playerId),
      );
      const matchup = this.matchups[index];
      if (!matchup) throw new RoomError('invalid', 'That prompt is not yours');
      const slot = matchup.playerIds[0] === playerId ? 0 : 1;
      if (matchup.answers[slot])
        throw new RoomError('already_submitted', 'You already answered that one');
      matchup.answers[slot] = build(
        this.answerLimit(matchup, playerId),
        this.answerLetters(matchup, playerId),
      );
      this.recordSubmission(player, matchup.answers[slot]);
    } else if (this.phase === 'FINAL_WRITING' && this.final) {
      if (
        !this.final.playerIds.includes(playerId) ||
        this.wallPrompt(this.final, playerId).id !== promptId
      )
        throw new RoomError('invalid', 'That prompt is not yours');
      if (this.final.answers.has(playerId))
        throw new RoomError('already_submitted', 'You already answered');
      const answer = build(this.final.limit, this.final.prompt.letters ?? null);
      this.final.answers.set(playerId, answer);
      this.recordSubmission(player, answer);
    } else {
      throw new RoomError('bad_phase', 'Nobody is writing right now');
    }
    if (this.allWritingDone()) this.endWriting();
    else {
      this.broadcast();
      this.sendPrivateState(playerId);
    }
  }

  /** An unused stock answer that fits; reused only once every fitting one has been dealt. */
  private pickBailOut(limit: number | null): string {
    const bank = this.deps.bailOuts ?? FALLBACK_BAIL_OUTS;
    const fits = bank.filter((text) => limit === null || countWords(text) <= limit);
    const fresh = fits.filter((text) => !this.usedBailOuts.has(text));
    const pool = fresh.length > 0 ? fresh : fits;
    const pick = pool[Math.floor(this.random() * pool.length)];
    if (pick === undefined) throw new RoomError('invalid', 'No Bail Out fits that limit');
    this.usedBailOuts.add(pick);
    return pick;
  }

  /** Freezes every clock; nothing can be submitted until the leader resumes. */
  pauseGame(playerId: string): void {
    this.requireLeader(playerId);
    if (this.phase === 'LOBBY' || this.phase === 'PODIUM')
      throw new RoomError('bad_phase', 'There is nothing to pause');
    if (this.pause) throw new RoomError('paused', 'The game is already paused');
    const now = Date.now();
    this.clearTimer();
    const roastOpen = this.roastTimer !== null && this.roastWindowEndsAt !== null;
    if (this.roastTimer) clearTimeout(this.roastTimer);
    this.roastTimer = null;
    this.pause = {
      byName: this.requirePlayer(playerId).name,
      at: now,
      remainingMs: this.phaseEndsAt === null ? null : Math.max(this.phaseEndsAt - now, 0),
      roastRemainingMs: roastOpen ? Math.max(this.roastWindowEndsAt! - now, 0) : null,
    };
    this.phaseEndsAt = null;
    this.broadcast();
  }

  resumeGame(playerId: string): void {
    this.requireLeader(playerId);
    const pause = this.pause;
    if (!pause) throw new RoomError('bad_phase', 'The game is not paused');
    const now = Date.now();
    this.pause = null;
    // Shifting the start keeps every client's ring and reveal schedule where it stopped.
    this.phaseStartedAt += now - pause.at;
    if (pause.remainingMs !== null) {
      this.phaseEndsAt = now + pause.remainingMs;
      this.schedulePhaseTimer(pause.remainingMs);
    }
    if (pause.roastRemainingMs !== null) {
      this.roastWindowEndsAt = now + pause.roastRemainingMs;
      this.roastTimer = setTimeout(() => this.closeRoastWindow(), pause.roastRemainingMs);
    }
    this.broadcast();
    for (const player of this.players) {
      if (player.connected) this.sendPrivateState(player.id);
    }
    this.afterPresenceChange();
  }

  /** Timers off: the leader closes a writing or voting phase; stragglers are auto-submitted. */
  advancePhase(playerId: string): void {
    this.requireLeader(playerId);
    this.requireUnpaused();
    if (this.settings.timers !== 'off')
      throw new RoomError('invalid', 'The clock moves the game on in this room');
    const movable =
      this.phase === 'CREATING' ||
      (this.phase === 'WRITING' && this.promptsDealt) ||
      this.phase === 'FINAL_WRITING' ||
      this.phase === 'VOTING' ||
      this.phase === 'FINAL_VOTING';
    if (!movable) throw new RoomError('bad_phase', 'Nothing to move on from right now');
    this.onPhaseTimeout();
  }

  /** Lobby and podium: the player is removed. Mid-game: their seat is closed to them. */
  kickPlayer(leaderId: string, targetId: string): void {
    this.requireLeader(leaderId);
    if (targetId === leaderId) throw new RoomError('self_target', 'You cannot remove yourself');
    const member = this.audience.get(targetId);
    const target = this.players.find((p) => p.id === targetId && !p.kicked);
    if (!member && !target) throw new RoomError('not_found', 'That player is not here');
    this.deps.send(targetId, { type: 'left', payload: {} });
    const name = member?.name ?? target!.name;
    if (member || this.phase === 'LOBBY' || this.phase === 'PODIUM') {
      this.leave(targetId);
    } else {
      target!.kicked = true;
      target!.slotExpired = true;
      this.disconnect(targetId, false);
    }
    this.banner = `${name} was removed by the leader`;
    this.broadcast();
  }

  submitDrawing(playerId: string, promptId: string, encoded: string): void {
    this.requirePhase('CREATING');
    this.requireUnpaused();
    const player = this.requireActor(playerId);
    const task = this.requireTask(playerId, promptId, 'draw');
    let blank: boolean;
    try {
      blank = isBlankDrawing(decodeDrawing(encoded));
    } catch (error) {
      if (!(error instanceof DrawingError)) throw error;
      throw new RoomError('invalid', 'That drawing did not come through. Try again.');
    }
    if (blank) throw new RoomError('empty', 'Draw something first');
    this.addSeed(player, task, 'drawing', encoded);
  }

  castVote(playerId: string, matchupIndex: number, answerIndex: 0 | 1): void {
    this.requirePhase('VOTING');
    this.requireUnpaused();
    if (matchupIndex !== this.currentMatchupIndex)
      throw new RoomError('bad_phase', 'That matchup is not open');
    const matchup = this.currentMatchup();
    if (answerIndex !== 0 && answerIndex !== 1)
      throw new RoomError('invalid', 'Pick one of the two answers');
    if (this.audience.has(playerId)) {
      // The audience never holds up the room: their votes only decide the Crowd Favourite.
      if (playerId in matchup.audienceVotes)
        throw new RoomError('already_submitted', 'You already voted');
      matchup.audienceVotes[playerId] = answerIndex;
      this.broadcast();
      return;
    }
    this.requireActor(playerId);
    if (matchup.playerIds.includes(playerId))
      throw new RoomError('invalid', 'You cannot vote on your own matchup');
    if (playerId in matchup.votes) throw new RoomError('already_submitted', 'You already voted');
    matchup.votes[playerId] = answerIndex;
    if (this.allVotesIn()) this.revealMatchup();
    else this.broadcast();
  }

  castFinalVotes(playerId: string, rawFirst: string, rawSecond: string): void {
    this.requirePhase('FINAL_VOTING');
    this.requireUnpaused();
    const final = this.final;
    if (!final) throw new RoomError('bad_phase', 'No final round');
    if (this.audience.has(playerId)) {
      // One pick for the audience, in every wall round.
      if (playerId in final.audienceVotes)
        throw new RoomError('already_submitted', 'You already voted');
      const authorId = this.wallAuthor(final, rawFirst);
      if (authorId === null || !final.answers.has(authorId))
        throw new RoomError('invalid', 'Pick one answer');
      final.audienceVotes[playerId] = final.posts ? rawFirst : authorId;
      this.broadcast();
      return;
    }
    this.requireActor(playerId);
    if (playerId in final.votes) throw new RoomError('already_submitted', 'You already voted');
    if (final.posts) {
      const post = final.posts.find((p) => p.id === rawFirst);
      if (!post || rawSecond !== '') throw new RoomError('invalid', 'Pick one post');
      if (post.twisterId === playerId)
        throw new RoomError('invalid', 'You cannot vote for your own twist');
      final.votes[playerId] = [rawFirst, ''];
      if (this.allFinalVotesIn()) this.finishFinal();
      else this.broadcast();
      return;
    }
    const first = this.wallAuthor(final, rawFirst) ?? '';
    const second = this.wallAuthor(final, rawSecond) ?? '';
    if (first === second) throw new RoomError('invalid', 'Pick two different answers');
    if (first === playerId || second === playerId)
      throw new RoomError('invalid', 'You cannot vote for yourself');
    if (!final.answers.has(first) || !final.answers.has(second))
      throw new RoomError('invalid', 'Unknown answer');
    final.votes[playerId] = [first, second];
    if (this.allFinalVotesIn()) this.finishFinal();
    else this.broadcast();
  }

  rematch(playerId: string): void {
    this.requirePhase('PODIUM');
    this.requireLeader(playerId);
    for (const player of [...this.players]) {
      if (!player.connected) this.removePlayer(player.id);
    }
    this.gamesPlayed += 1;
    this.podium = null;
    this.final = null;
    this.matchups = [];
    this.roundIndex = 0;
    this.currentMatchupIndex = 0;
    this.promptsDealt = false;
    this.encore = [];
    this.highlights = [];
    this.customPrompts = this.customPrompts.filter((p) => !this.usedPromptIds.has(p.id));
    this.banner = null;
    this.enterPhase('LOBBY', null);
    // The audience waited a whole game; free seats are theirs first.
    this.fillSeatsFromAudience();
    this.broadcast();
  }

  // ------------------------------------------------------------ state machine

  private beginRound(index: RoundIndex): void {
    this.roundIndex = index;
    this.currentMatchupIndex = 0;
    this.roastWindowEndsAt = null;
    this.promptsDealt = false;
    this.tasks = new Map();
    this.seeds = new Map();
    this.final = null;
    if (index === FINAL_ROUND && this.settings.mode !== 'context') {
      const prompt = this.withLetters(this.withPlayerName(this.finalPrompt(), this.dealtPlayers()));
      this.final = {
        prompt,
        posts: null,
        playerIds: this.dealtPlayers().map((p) => p.id),
        limit: this.roundLimit(),
        answers: new Map(),
        votes: {},
        audienceVotes: {},
        anonIds: null,
        result: null,
      };
      this.matchups = [];
    } else {
      // Seeded modes deal once the round's drawings or honest answers are in.
      this.matchups = this.seeded ? [] : this.generateMatchups(index, this.unusedCustomPrompts());
    }
    this.enterPhase('ROUND_INTRO', TIMERS.ROUND_INTRO);
  }

  private get seeded(): boolean {
    return this.settings.mode === 'doodle' || this.settings.mode === 'context';
  }

  /** The prompt this player answers in a wall round: their post to twist, or the shared one. */
  private wallPrompt(final: FinalRound, playerId: string): DealtPrompt {
    const post = final.posts?.find((p) => p.twisterId === playerId);
    if (!post) return final.prompt;
    return {
      id: post.id,
      text: SITES[post.site].instruction,
      rounds: [this.roundIndex],
      post,
    };
  }

  /** Custom leftovers, then the replayed crowd favourite in seeded modes, then the packs. */
  private finalPrompt(): DealtPrompt {
    const custom = this.unusedCustomPrompts();
    if (custom.length > 0) {
      const pick = custom[Math.floor(this.random() * custom.length)]!;
      this.usedPromptIds.add(pick.id);
      return pick;
    }
    if (this.seeded && this.encore.length > 0) {
      const most = Math.max(...this.encore.map((e) => e.votes));
      const favourites = this.encore.filter((e) => e.votes === most);
      return favourites[Math.floor(this.random() * favourites.length)]!.prompt;
    }
    return this.deps.deck.draw(FINAL_ROUND, 1, this.usedPromptIds, this.settings.packs)[0]!;
  }

  private unusedCustomPrompts(): DealtPrompt[] {
    if (this.settings.mode !== 'custom') return [];
    return this.customPrompts
      .filter((p) => !this.usedPromptIds.has(p.id))
      .map((p) => ({ id: p.id, text: p.text, rounds: [0, 1, 2], authorId: p.authorId }));
  }

  /** Doodle / Out of Context: everyone gets a secret suggestion or a question about themselves. */
  private startCreating(): void {
    const banks = this.deps.seedBanks ?? FALLBACK_SEEDS;
    const kind = this.settings.mode === 'doodle' ? 'draw' : 'confess';
    const pool = this.shuffled(kind === 'draw' ? banks.doodles : banks.questions);
    this.dealtPlayers().forEach((player, i) => {
      this.seedSeq += 1;
      this.tasks.set(player.id, {
        id: `t${this.seedSeq}`,
        kind,
        text: pool[i % pool.length]!,
      });
    });
    this.enterPhase('CREATING', this.clock(kind === 'draw' ? TIMERS.DRAWING : TIMERS.CONFESSING));
    for (const player of this.players) {
      if (player.connected) this.sendPrivateState(player.id);
    }
    if (this.allCreatingDone()) this.endCreating();
  }

  private addSeed(player: Player, task: Task, kind: Seed['kind'], content: string): void {
    if (this.seeds.has(player.id))
      throw new RoomError('already_submitted', 'You already sent that one');
    this.seeds.set(player.id, { kind, authorId: player.id, question: task.text, content });
    if (this.allCreatingDone()) this.endCreating();
    else {
      this.broadcast();
      this.sendPrivateState(player.id);
    }
  }

  /**
   * Doodle: drawings become the round's matchup prompts (a player who drew nothing leaves a
   * slot for the packs). Out of Context: each quote goes to the next player on a shuffled
   * ring, who twists it, and the round is a wall round.
   */
  private endCreating(): void {
    if (this.settings.mode === 'context') {
      this.final = this.buildPostWall();
      this.startWriting();
      return;
    }
    const authored: DealtPrompt[] = [...this.seeds.values()].map((seed) => {
      this.seedSeq += 1;
      const id = `s${this.seedSeq}`;
      this.drawings.set(id, seed.content);
      return {
        id,
        text: DRAWING_PROMPT_TEXT,
        rounds: [this.roundIndex],
        authorId: seed.authorId,
        seed,
      };
    });
    this.matchups = this.generateMatchups(this.roundIndex, authored);
    this.startWriting();
  }

  private buildPostWall(): FinalRound {
    const ring = this.shuffled([...this.tasks.keys()]);
    const posts = ring.map((victimId, i): Post => {
      this.seedSeq += 1;
      return {
        id: `q${this.seedSeq}`,
        victimId,
        twisterId: ring[(i + 1) % ring.length]!,
        quote: this.seeds.get(victimId)?.content ?? NO_COMMENT,
        site: SITE_IDS[Math.floor(this.random() * SITE_IDS.length)]!,
      };
    });
    return {
      prompt: {
        id: `w${this.seedSeq}`,
        text: 'Take it out of context.',
        rounds: [this.roundIndex],
      },
      posts,
      playerIds: ring,
      limit: this.roundLimit(),
      answers: new Map(),
      votes: {},
      audienceVotes: {},
      anonIds: null,
      result: null,
    };
  }

  private allCreatingDone(): boolean {
    return [...this.tasks.keys()].every(
      (id) => this.seeds.has(id) || !this.isPlaying(this.requirePlayer(id)),
    );
  }

  private requireTask(playerId: string, promptId: string, kind: Task['kind']): Task {
    const task = this.tasks.get(playerId);
    if (!task || task.id !== promptId || task.kind !== kind)
      throw new RoomError('invalid', 'That is not your task');
    return task;
  }

  /** Fills {player} with someone in the room, preferring anyone not answering it. */
  private withPlayerName(prompt: DealtPrompt, candidates: Player[]): DealtPrompt {
    if (!prompt.text.includes(PLAYER_TOKEN)) return prompt;
    const pool = candidates.length > 0 ? candidates : this.players;
    const named = pool[Math.floor(this.random() * pool.length)];
    return { ...prompt, text: prompt.text.split(PLAYER_TOKEN).join(named?.name ?? 'someone') };
  }

  /** Initials mode: the same fresh letters for everyone answering this prompt. */
  private withLetters(prompt: DealtPrompt): DealtPrompt {
    if (this.settings.mode !== 'initials') return prompt;
    const count = INITIALS_LENGTHS[this.roundIndex];
    const letters = Array.from(
      { length: count },
      () => INITIAL_POOL[Math.floor(this.random() * INITIAL_POOL.length)]!,
    ).join('');
    return { ...prompt, letters };
  }

  /** Ring pairing: player i vs player i+1 (mod N); N matchups. */
  private generateMatchups(round: RoundIndex, authored: DealtPrompt[]): Matchup[] {
    const dealt = this.dealtPlayers();
    const order = this.shuffled(dealt.map((p) => p.id));
    const pairs = order.map(
      (playerId, i) => [playerId, order[(i + 1) % order.length]!] as [string, string],
    );
    const prompts = this.promptsForPairs(round, pairs, authored).map((prompt, i) =>
      this.withLetters(
        this.withPlayerName(
          prompt,
          dealt.filter((p) => !pairs[i]!.includes(p.id)),
        ),
      ),
    );
    // Public slot order and matchup order must not follow the ring, or a revealed
    // matchup would name a neighbour in the next one.
    const matchups: Matchup[] = order.map((_, i) => {
      const pair = pairs[i]!;
      const playerIds: [string, string] = this.random() < 0.5 ? [pair[1], pair[0]] : pair;
      return {
        prompt: prompts[i]!,
        playerIds,
        answers: [null, null],
        votes: {},
        audienceVotes: {},
        roast: null,
        result: null,
        revealed: false,
      };
    });
    return this.shuffled(matchups);
  }

  /** Authored prompts matched away from their authors first, leftovers next, then the packs. */
  private promptsForPairs(
    round: RoundIndex,
    pairs: [string, string][],
    authored: DealtPrompt[],
  ): DealtPrompt[] {
    const fresh = this.shuffled(authored);
    const holder: (number | undefined)[] = pairs.map(() => undefined);
    const augment = (index: number, seen: Set<number>): boolean => {
      for (let slot = 0; slot < pairs.length; slot++) {
        if (seen.has(slot) || pairs[slot]!.includes(fresh[index]!.authorId ?? '')) continue;
        seen.add(slot);
        const current = holder[slot];
        if (current === undefined || augment(current, seen)) {
          holder[slot] = index;
          return true;
        }
      }
      return false;
    };
    for (let index = 0; index < fresh.length && holder.includes(undefined); index++) {
      augment(index, new Set());
    }
    const leftovers = fresh.filter((_, index) => !holder.includes(index));
    const custom = holder.map((index) => (index === undefined ? leftovers.shift() : fresh[index]));
    for (const prompt of custom) if (prompt) this.usedPromptIds.add(prompt.id);
    const bank = this.deps.deck.draw(
      round,
      custom.filter((p) => !p).length,
      this.usedPromptIds,
      this.settings.packs,
    );
    return custom.map((prompt) => prompt ?? bank.shift()!);
  }

  private startWriting(): void {
    const spec = roundSpec(this.roundIndex);
    if (this.final) {
      this.enterPhase('FINAL_WRITING', this.clock(spec.writingMs));
      this.dealPrompts();
      return;
    }
    this.enterPhase('WRITING', this.clock(spec.writingMs));
    if (this.settings.roasts && this.roundIndex >= LIMITS.ROAST_FROM_ROUND) {
      const window = roastWindowMs(this.settings.timers);
      this.roastWindowEndsAt = Date.now() + window;
      this.roastTimer = setTimeout(() => this.closeRoastWindow(), window);
      this.broadcast();
      for (const player of this.players) {
        if (player.connected) this.sendPrivateState(player.id);
      }
    } else {
      this.dealPrompts();
    }
  }

  private closeRoastWindow(): void {
    this.roastTimer = null;
    this.roastWindowEndsAt = null;
    this.dealPrompts();
  }

  private dealPrompts(): void {
    this.promptsDealt = true;
    this.promptsDealtAt = Date.now();
    if (this.allWritingDone()) {
      this.endWriting();
      return;
    }
    this.broadcast();
    for (const player of this.players) {
      if (player.connected) this.sendPrivateState(player.id);
    }
  }

  private endWriting(): void {
    if (this.roastTimer) {
      clearTimeout(this.roastTimer);
      this.roastTimer = null;
      this.roastWindowEndsAt = null;
    }
    if (this.phase === 'FINAL_WRITING' && this.final) {
      for (const player of this.finalPlayers()) {
        if (!this.final.answers.has(player.id)) {
          this.final.answers.set(player.id, this.fallbackAnswer(player, this.final.limit));
        }
      }
      if (this.settings.anonymousFinal && !this.final.posts) {
        this.final.anonIds = new Map(
          [...this.final.answers.keys()].map((id) => [id, this.opaqueId()]),
        );
      }
      this.enterPhase('FINAL_VOTING', this.clock(TIMERS.FINAL_VOTING));
      if (this.allFinalVotesIn()) this.finishFinal();
      return;
    }
    for (const matchup of this.matchups) {
      matchup.playerIds.forEach((playerId, slot) => {
        if (!matchup.answers[slot]) {
          matchup.answers[slot] = this.fallbackAnswer(
            this.requirePlayer(playerId),
            this.answerLimit(matchup, playerId),
          );
        }
      });
    }
    this.currentMatchupIndex = 0;
    this.startVoting();
  }

  private startVoting(): void {
    this.enterPhase('VOTING', this.clock(TIMERS.VOTING));
    if (this.allVotesIn()) this.revealMatchup();
  }

  private revealMatchup(): void {
    const matchup = this.currentMatchup();
    const [a, b] = matchup.answers;
    if (!a || !b) throw new Error('Cannot reveal a matchup with missing answers');
    const result = scoreMatchup({
      answers: [a, b],
      votes: matchup.votes,
      audienceVotes: matchup.audienceVotes,
      roast: matchup.roast,
      multiplier: roundSpec(this.roundIndex).multiplier,
    });
    for (const [playerId, delta] of Object.entries(result.delta)) {
      this.requirePlayer(playerId).score += delta;
    }
    [a, b].forEach((answer, slot) => {
      this.requirePlayer(answer.playerId).stats.votesReceived += result.voteCounts[slot]!;
    });
    if (matchup.roast) {
      this.requirePlayer(matchup.roast.targetId).stats.roasted += 1;
      const spender = this.players.find((p) => p.id === matchup.roast!.spenderId);
      if (spender) spender.publicRoastTokens = spender.roastTokens;
    }
    for (const id of matchup.playerIds) {
      const player = this.requirePlayer(id);
      player.publicStats.votesReceived = player.stats.votesReceived;
      player.publicStats.roasted = player.stats.roasted;
    }
    matchup.result = result;
    matchup.revealed = true;
    this.enterPhase('MATCHUP_REVEAL', revealDuration(a.text.length + b.text.length));
    this.broadcastAll({ type: 'reveal', payload: { matchupIndex: this.currentMatchupIndex } });
  }

  private afterReveal(): void {
    if (this.currentMatchupIndex + 1 < this.matchups.length) {
      this.currentMatchupIndex += 1;
      this.startVoting();
    } else {
      for (const m of this.matchups) {
        if (m.prompt.seed)
          this.encore.push({ prompt: m.prompt, votes: Object.keys(m.votes).length });
      }
      this.recordMatchupHighlight();
      this.publishStats();
      this.enterPhase('ROUND_RESULTS', TIMERS.ROUND_RESULTS);
    }
  }

  /** Tallies the final, then reveals it answer by answer; scores land at the podium. */
  private finishFinal(): void {
    const final = this.final;
    if (!final) throw new Error('finishFinal without a final round');
    const ids = this.players.map((p) => p.id);
    const multiplier = roundSpec(this.roundIndex).multiplier;
    const answers = [...final.answers.values()];
    const options = {
      bailOutIds: new Set(answers.filter((a) => a.bailOut).map((a) => a.playerId)),
      audienceVotes: final.audienceVotes,
    };
    final.result = final.posts
      ? scorePosts(final.votes, final.posts, ids, multiplier, options)
      : scoreFinal(final.votes, ids, multiplier, options);
    this.recordWallHighlight(final);
    this.enterPhase('FINAL_REVEAL', finalRevealSchedule(final.answers.size).totalMs);
  }

  /** Wall-round points land after the reveal; then the next round, or the podium. */
  private afterWallReveal(): void {
    const result = this.final?.result;
    if (!result) throw new Error('afterWallReveal before the wall was tallied');
    for (const [playerId, tally] of Object.entries(result)) {
      const player = this.players.find((p) => p.id === playerId);
      if (!player) continue;
      player.score += tally.points + tally.pity;
      player.stats.votesReceived += tally.first + tally.second;
    }
    this.publishStats();
    if (this.roundIndex !== FINAL_ROUND) {
      this.enterPhase('ROUND_RESULTS', TIMERS.ROUND_RESULTS);
      return;
    }
    const publicPlayers = this.players.map((p) => this.publicPlayer(p));
    this.podium = {
      placements: computePlacements(publicPlayers),
      superlatives: computeSuperlatives(publicPlayers),
    };
    this.enterPhase('PODIUM', null);
    this.deps.onGameEvent?.({ type: 'finished' });
    this.dropExpiredSlots();
    for (const player of this.players) {
      if (!player.connected && !player.removalTimer) {
        player.removalTimer = setTimeout(() => this.expireSlot(player.id), RECONNECT_HOLD_MS);
      }
    }
  }

  private onPhaseTimeout(): void {
    switch (this.phase) {
      case 'ROUND_INTRO':
        if (this.settings.mode === 'context' || (this.seeded && this.roundIndex !== FINAL_ROUND))
          this.startCreating();
        else this.startWriting();
        return;
      case 'CREATING':
        this.endCreating();
        return;
      case 'WRITING':
      case 'FINAL_WRITING':
        this.endWriting();
        return;
      case 'VOTING':
        this.revealMatchup();
        return;
      case 'MATCHUP_REVEAL':
        this.afterReveal();
        return;
      case 'ROUND_RESULTS':
        this.beginRound(nextRound(this.roundIndex, this.settings.length));
        return;
      case 'FINAL_VOTING':
        this.finishFinal();
        return;
      case 'FINAL_REVEAL':
        this.afterWallReveal();
        return;
      default:
        return;
    }
  }

  private enterPhase(phase: RoomPhase, durationMs: number | null): void {
    this.clearTimer();
    this.phase = phase;
    this.phaseStartedAt = Date.now();
    this.phaseEndsAt = durationMs === null ? null : Date.now() + durationMs;
    if (durationMs !== null) this.schedulePhaseTimer(durationMs);
    this.broadcast();
  }

  private schedulePhaseTimer(durationMs: number): void {
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.onPhaseTimeout();
    }, durationMs);
  }

  /** A writing, drawing or voting clock under the room's timer speed. */
  private clock(ms: number): number | null {
    return phaseClock(ms, this.settings.timers);
  }

  private clearTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  /** A disconnect can be the last thing a phase was waiting on. */
  private afterPresenceChange(): void {
    // A paused room only moves on when the leader resumes (which re-runs this check).
    if (this.pause) return;
    if (this.phase === 'CREATING') {
      if (this.allCreatingDone()) this.endCreating();
    } else if ((this.phase === 'WRITING' && this.promptsDealt) || this.phase === 'FINAL_WRITING') {
      if (this.allWritingDone()) this.endWriting();
    } else if (this.phase === 'VOTING') {
      if (this.allVotesIn()) this.revealMatchup();
    } else if (this.phase === 'FINAL_VOTING') {
      if (this.allFinalVotesIn()) this.finishFinal();
    }
  }

  // ------------------------------------------------------------------ helpers

  /** Word/timing stats and token counts go public only between rounds (see publicPlayer). */
  private publishStats(): void {
    for (const player of this.players) {
      player.publicStats = { ...player.stats };
      player.publicRoastTokens = player.roastTokens;
    }
  }

  private assignMissingCharacters(): void {
    const free = this.shuffled(
      CHARACTER_IDS.filter((id) => !this.players.some((p) => p.characterId === id)),
    );
    for (const player of this.players) {
      if (player.characterId === null) player.characterId = free.pop() ?? null;
    }
  }

  /** The round's word limit, or null when the leader switched limits off. Initials mode
   *  always has one word per letter. */
  private roundLimit(): number | null {
    if (this.settings.mode === 'initials') return INITIALS_LENGTHS[this.roundIndex];
    return this.settings.wordLimits ? roundSpec(this.roundIndex).limit : null;
  }

  private answerLimit(matchup: Matchup, playerId: string): number | null {
    return matchup.roast?.targetId === playerId ? LIMITS.ROASTED_LIMIT : this.roundLimit();
  }

  /** A roast in Initials keeps only the first two letters. */
  private answerLetters(matchup: Matchup, playerId: string): string | null {
    const letters = matchup.prompt.letters;
    if (!letters) return null;
    return matchup.roast?.targetId === playerId ? letters.slice(0, LIMITS.ROASTED_LIMIT) : letters;
  }

  private buildAnswer(
    player: Player,
    rawText: string,
    limit: number | null,
    letters: string | null,
  ): Answer {
    const validation = validateAnswer(rawText, limit, letters);
    if (!validation.ok) {
      const messages: Record<string, string> = {
        over_limit: `That's over the ${limit}-word limit`,
        too_long: `Keep it under ${LIMITS.MAX_CHARS} characters`,
        empty: 'Say something. Anything.',
        bad_initials: `One word per letter: ${Array.from(letters ?? '').join(' · ')}`,
      };
      const code = validation.error ?? 'invalid';
      throw new RoomError(code, messages[code] ?? 'Invalid answer');
    }
    return {
      playerId: player.id,
      text: validation.text,
      wordCount: validation.count,
      autoSubmitted: false,
      effectiveLimit: limit,
      bailOut: false,
    };
  }

  private fallbackAnswer(player: Player, limit: number | null): Answer {
    return {
      playerId: player.id,
      text: player.connected ? AUTO_SUBMIT_TEXT : LEFT_TEXT,
      wordCount: 0,
      autoSubmitted: true,
      effectiveLimit: limit,
      bailOut: false,
    };
  }

  private recordSubmission(player: Player, answer: Answer): void {
    player.stats.wordsUsedTotal += answer.wordCount;
    player.stats.submissions += 1;
    player.stats.submitMsTotal += Math.max(Date.now() - this.promptsDealtAt, 0);
  }

  private allWritingDone(): boolean {
    if (this.phase === 'FINAL_WRITING' && this.final) {
      return this.finalPlayers().every((p) => !this.isPlaying(p) || this.final!.answers.has(p.id));
    }
    return this.matchups.every((m) =>
      m.playerIds.every(
        (id, slot) => m.answers[slot] !== null || !this.isPlaying(this.requirePlayer(id)),
      ),
    );
  }

  /** One roast per matchup; a clash moves the earlier roast to its target's other matchup. */
  private placeRoast(roast: Roast, seen: Set<Matchup>): boolean {
    for (const matchup of this.matchups) {
      if (!matchup.playerIds.includes(roast.targetId) || seen.has(matchup)) continue;
      seen.add(matchup);
      if (!matchup.roast || this.placeRoast(matchup.roast, seen)) {
        matchup.roast = roast;
        return true;
      }
    }
    return false;
  }

  private eligibleVoters(matchup: Matchup): Player[] {
    return this.players.filter((p) => this.isPlaying(p) && !matchup.playerIds.includes(p.id));
  }

  private allVotesIn(): boolean {
    const matchup = this.currentMatchup();
    return this.eligibleVoters(matchup).every((p) => p.id in matchup.votes);
  }

  private allFinalVotesIn(): boolean {
    const final = this.final;
    if (!final) return true;
    return this.players.filter((p) => this.isPlaying(p)).every((p) => p.id in final.votes);
  }

  private currentMatchup(): Matchup {
    const matchup = this.matchups[this.currentMatchupIndex];
    if (!matchup) throw new Error(`No matchup at index ${this.currentMatchupIndex}`);
    return matchup;
  }

  /** Players gone past the grace sit the round out while at least three remain connected. */
  private dealtPlayers(): Player[] {
    if (this.connectedCount < LIMITS.MIN_PLAYERS) return this.players;
    return this.players.filter((p) => this.isPlaying(p));
  }

  private finalPlayers(): Player[] {
    return this.players.filter((p) => this.final?.playerIds.includes(p.id));
  }

  private isPlaying(player: Player): boolean {
    return player.connected || Date.now() < player.graceEndsAt;
  }

  /** The player behind an intent: a kicked player's phone no longer counts. */
  private requireActor(playerId: string): Player {
    const player = this.requirePlayer(playerId);
    if (player.kicked) throw new RoomError('not_found', 'You are not in this room');
    return player;
  }

  private requireUnpaused(): void {
    if (this.pause) throw new RoomError('paused', 'The game is paused');
  }

  /** The author behind a wall vote id: a post id, an anonymous id, or a player id. */
  private wallAuthor(final: FinalRound, answerId: string): string | null {
    if (final.posts) return final.posts.find((p) => p.id === answerId)?.twisterId ?? null;
    if (final.anonIds) {
      for (const [playerId, anon] of final.anonIds) if (anon === answerId) return playerId;
      return null;
    }
    return final.answers.has(answerId) ? answerId : null;
  }

  /** The id an answer is voted with on the wall, as this room shows it right now. */
  private wallAnswerId(final: FinalRound, playerId: string): string {
    const post = final.posts?.find((p) => p.twisterId === playerId);
    if (post) return post.id;
    const revealed = this.phase === 'FINAL_REVEAL' || this.phase === 'PODIUM';
    return (!revealed && final.anonIds?.get(playerId)) || playerId;
  }

  private opaqueId(): string {
    return `a${Math.floor(this.random() * 36 ** 8).toString(36)}`;
  }

  /** The round's most-voted real answer, for the podium. */
  private recordMatchupHighlight(): void {
    let best: Highlight | null = null;
    for (const m of this.matchups) {
      m.answers.forEach((answer, slot) => {
        const votes = m.result?.voteCounts[slot] ?? 0;
        if (!answer || answer.autoSubmitted || votes === 0) return;
        if (best && votes <= best.votes) return;
        best = {
          roundIndex: this.roundIndex,
          promptText: m.prompt.text,
          text: answer.text,
          playerId: answer.playerId,
          votes,
        };
      });
    }
    if (best) this.highlights.push(best);
  }

  private recordWallHighlight(final: FinalRound): void {
    let best: Highlight | null = null;
    for (const [playerId, tally] of Object.entries(final.result ?? {})) {
      const answer = final.answers.get(playerId);
      const votes = tally.first + tally.second;
      if (!answer || answer.autoSubmitted || votes === 0) continue;
      if (best && votes <= best.votes) continue;
      const post = final.posts?.find((p) => p.twisterId === playerId);
      best = {
        roundIndex: this.roundIndex,
        promptText: post ? `"${post.quote}"` : final.prompt.text,
        text: answer.text,
        playerId,
        votes,
      };
    }
    if (best) this.highlights.push(best);
  }

  private requirePlayer(playerId: string): Player {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) throw new RoomError('not_found', 'You are not in this room');
    return player;
  }

  private requirePhase(phase: RoomPhase): void {
    if (this.phase !== phase) throw new RoomError('bad_phase', `Not allowed during ${this.phase}`);
  }

  private requireLeader(playerId: string): void {
    if (this.leaderId !== playerId)
      throw new RoomError('not_leader', 'Only the room leader can do that');
  }

  private shuffled<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }

  // ------------------------------------------------------- public projections

  publicState(): PublicRoomState {
    const now = Date.now();
    return {
      code: this.code,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      phaseStartedAt: this.phaseStartedAt,
      roundIndex: this.roundIndex,
      players: this.players.map((p) => this.publicPlayer(p)),
      leaderId: this.leaderId,
      settings: { ...this.settings },
      customPrompts: this.phase === 'LOBBY' ? this.customPrompts.map((p) => ({ ...p })) : [],
      matchups: this.matchups.map((m, i) => this.publicMatchup(m, i)),
      currentMatchupIndex: this.currentMatchupIndex,
      roastWindowEndsAt: this.roastWindowEndsAt,
      submittedIds: this.submittedIds(),
      votedIds: this.votedIds(),
      final: this.publicFinal(),
      podium: this.podium,
      banner: this.banner,
      gamesPlayed: this.gamesPlayed,
      paused: this.pause
        ? { byName: this.pause.byName, remainingMs: this.pause.remainingMs }
        : null,
      audienceCount: [...this.audience.values()].filter((m) => m.connected).length,
      highlights: this.phase === 'PODIUM' ? [...this.highlights] : [],
      viewer: { role: 'player', finalAnswerId: null },
      serverNow: now,
    };
  }

  private viewerState(viewerId: string): ViewerState {
    const final = this.final;
    const wrote = final?.answers.has(viewerId) || final?.playerIds.includes(viewerId);
    return {
      role: this.audience.has(viewerId) ? 'audience' : 'player',
      finalAnswerId: final && wrote ? this.wallAnswerId(final, viewerId) : null,
    };
  }

  /** The player's own prompts for the current round; kept available through voting so a
   *  refreshed client still knows which matchups it wrote (it must not vote on those). */
  yourPrompts(playerId: string): YourPrompt[] {
    const roundActive =
      this.phase === 'WRITING' ||
      this.phase === 'VOTING' ||
      this.phase === 'MATCHUP_REVEAL' ||
      this.phase === 'ROUND_RESULTS';
    if (roundActive && this.promptsDealt && this.matchups.length > 0) {
      const prompts: YourPrompt[] = [];
      this.matchups.forEach((m, matchupIndex) => {
        const slot = m.playerIds.indexOf(playerId);
        if (slot === -1) return;
        prompts.push({
          kind: 'answer',
          promptId: m.prompt.id,
          text: m.prompt.text,
          seed: publicSeed(m.prompt, false),
          effectiveLimit: this.answerLimit(m, playerId),
          letters: this.answerLetters(m, playerId),
          matchupIndex,
          submittedText: m.answers[slot as 0 | 1]?.text ?? null,
        });
      });
      return prompts;
    }
    if (this.phase === 'FINAL_WRITING' && this.final?.playerIds.includes(playerId)) {
      const prompt = this.wallPrompt(this.final, playerId);
      return [
        {
          kind: 'answer',
          promptId: prompt.id,
          text: prompt.text,
          seed: publicSeed(prompt, false),
          effectiveLimit: this.final.limit,
          letters: prompt.letters ?? null,
          matchupIndex: null,
          submittedText: this.final.answers.get(playerId)?.text ?? null,
        },
      ];
    }
    const task = this.phase === 'CREATING' ? this.tasks.get(playerId) : undefined;
    if (task) {
      const seed = this.seeds.get(playerId);
      return [
        {
          kind: task.kind,
          promptId: task.id,
          text: task.text,
          seed: null,
          effectiveLimit: task.kind === 'confess' ? LIMITS.CONFESSION_WORDS : null,
          letters: null,
          matchupIndex: null,
          submittedText: seed ? (seed.kind === 'quote' ? seed.content : '') : null,
        },
      ];
    }
    return [];
  }

  /** Drawing ids the player's current screen can show. */
  private visibleDrawings(playerId: string): string[] {
    const ids = (prompts: DealtPrompt[]) =>
      prompts.filter((p) => p.seed?.kind === 'drawing').map((p) => p.id);
    switch (this.phase) {
      case 'WRITING':
        if (!this.promptsDealt) return [];
        return ids(
          this.matchups.filter((m) => m.playerIds.includes(playerId)).map((m) => m.prompt),
        );
      case 'VOTING':
      case 'MATCHUP_REVEAL':
      case 'ROUND_RESULTS':
        return ids(this.matchups.map((m) => m.prompt));
      case 'ROUND_INTRO':
      case 'FINAL_WRITING':
      case 'FINAL_VOTING':
      case 'FINAL_REVEAL':
      case 'PODIUM':
        return this.final ? ids([this.final.prompt]) : [];
      default:
        return [];
    }
  }

  /** Each drawing goes to each player once, ahead of the state that shows it. */
  private pushDrawings(playerId: string): void {
    const sent = this.sentDrawings.get(playerId) ?? new Set<string>();
    const items: Record<string, string> = {};
    for (const id of this.visibleDrawings(playerId)) {
      const encoded = this.drawings.get(id);
      if (encoded === undefined || sent.has(id)) continue;
      items[id] = encoded;
      sent.add(id);
    }
    this.sentDrawings.set(playerId, sent);
    if (Object.keys(items).length > 0) {
      this.deps.send(playerId, { type: 'drawings', payload: { items } });
    }
  }

  private sendPrivateState(playerId: string): void {
    const prompts = this.yourPrompts(playerId);
    const roastTokens = this.players.find((p) => p.id === playerId)?.roastTokens ?? 0;
    if (prompts.length > 0 || this.phase === 'WRITING' || this.phase === 'CREATING') {
      this.deps.send(playerId, { type: 'your_prompts', payload: { prompts, roastTokens } });
    }
    if (this.phase === 'WRITING') {
      const roast = this.matchups.find((m) => m.roast?.targetId === playerId)?.roast;
      if (roast) {
        const by = this.players.find((p) => p.id === roast.spenderId);
        this.deps.send(playerId, { type: 'roasted', payload: { byName: by?.name ?? 'someone' } });
      }
    }
  }

  private publicPlayer(p: Player): PublicPlayer {
    return {
      id: p.id,
      name: p.name,
      characterId: p.characterId,
      connected: p.connected,
      score: p.score,
      roastTokens: p.publicRoastTokens,
      stats: { ...p.publicStats },
      joinedAt: p.joinedAt,
    };
  }

  /** Redaction: prompt and answer text hidden until voting opens, authors and roasts until reveal. */
  private publicMatchup(m: Matchup, index: number): PublicMatchup {
    const votingOpen =
      m.revealed || (this.phase === 'VOTING' && index === this.currentMatchupIndex);
    const toPublic = (answer: Answer | null): PublicAnswer => ({
      playerId: m.revealed ? (answer?.playerId ?? null) : null,
      text: votingOpen ? (answer?.text ?? null) : null,
      wordCount: m.revealed ? (answer?.wordCount ?? null) : null,
      autoSubmitted: votingOpen ? (answer?.autoSubmitted ?? false) : false,
      effectiveLimit: m.revealed ? (answer?.effectiveLimit ?? null) : null,
      seed: null,
      bailOut: m.revealed ? (answer?.bailOut ?? false) : false,
      answerId: null,
    });
    return {
      promptId: votingOpen ? m.prompt.id : '',
      promptText: votingOpen ? m.prompt.text : '',
      letters: votingOpen ? (m.prompt.letters ?? null) : null,
      seed: votingOpen ? publicSeed(m.prompt, m.revealed) : null,
      answers: [toPublic(m.answers[0]), toPublic(m.answers[1])],
      votes: m.revealed ? { ...m.votes } : null,
      roast: m.revealed ? m.roast : null,
      result: m.result,
      revealed: m.revealed,
    };
  }

  private publicFinal(): PublicRoomState['final'] {
    const final = this.final;
    if (!final) return null;
    const revealed = this.phase === 'FINAL_REVEAL' || this.phase === 'PODIUM';
    const votingOpen = this.phase === 'FINAL_VOTING' || revealed;
    // Ranked final votes are cast by player id, so authorship is public once the wall opens.
    // Out of Context votes by post id and keeps the twister hidden until the reveal.
    const answers: PublicAnswer[] = votingOpen
      ? this.shuffledStable([...final.answers.values()]).map((answer) => ({
          playerId: (final.posts || final.anonIds) && !revealed ? null : answer.playerId,
          text: answer.text,
          wordCount: revealed ? answer.wordCount : null,
          autoSubmitted: answer.autoSubmitted,
          effectiveLimit: revealed ? answer.effectiveLimit : null,
          seed: final.posts ? publicSeed(this.wallPrompt(final, answer.playerId), revealed) : null,
          bailOut: revealed && answer.bailOut,
          answerId: this.wallAnswerId(final, answer.playerId),
        }))
      : [];
    return {
      prompt: { id: final.prompt.id, text: final.prompt.text },
      seed: final.posts ? null : publicSeed(final.prompt, revealed),
      voting: final.posts ? 'single' : 'rank',
      limit: final.limit,
      letters: final.prompt.letters ?? null,
      answers,
      votes: revealed ? { ...final.votes } : null,
      result: final.result,
    };
  }

  /** Deterministic order per room so every client sees the same card wall. Anonymous walls
   *  sort by the opaque ids, so the order cannot be recomputed from the player ids. */
  private shuffledStable<T extends { playerId: string }>(items: T[]): T[] {
    const key = (item: T) =>
      hash((this.final?.anonIds?.get(item.playerId) ?? item.playerId) + this.code);
    return [...items].sort((a, b) => key(a) - key(b));
  }

  private submittedIds(): string[] {
    if (this.phase === 'CREATING') {
      return this.players
        .filter((p) => !this.tasks.has(p.id) || this.seeds.has(p.id))
        .map((p) => p.id);
    }
    if (this.phase === 'WRITING') {
      return this.players
        .filter((p) =>
          this.matchups.every((m) => {
            const slot = m.playerIds.indexOf(p.id);
            return slot === -1 || m.answers[slot as 0 | 1] !== null;
          }),
        )
        .map((p) => p.id);
    }
    if (this.phase === 'FINAL_WRITING' && this.final) {
      const { playerIds, answers } = this.final;
      return this.players
        .filter((p) => !playerIds.includes(p.id) || answers.has(p.id))
        .map((p) => p.id);
    }
    return [];
  }

  /** Matchup voters are private: whoever is missing from the list would name the authors. */
  private votedIds(viewerId?: string): string[] {
    if (this.phase === 'VOTING') {
      const { votes, audienceVotes } = this.currentMatchup();
      return viewerId !== undefined && (viewerId in votes || viewerId in audienceVotes)
        ? [viewerId]
        : [];
    }
    if (this.phase === 'FINAL_VOTING' && this.final) {
      const ids = Object.keys(this.final.votes);
      if (viewerId !== undefined && viewerId in this.final.audienceVotes) ids.push(viewerId);
      return ids;
    }
    return [];
  }

  private broadcast(): void {
    if (this.closed) return;
    const state = this.publicState();
    for (const id of this.connectedViewerIds()) {
      if (this.drawings.size > 0) this.pushDrawings(id);
      const payload = { ...state, votedIds: this.votedIds(id), viewer: this.viewerState(id) };
      this.deps.send(id, { type: 'room_state', payload });
    }
  }

  private broadcastAll(message: ServerMessage): void {
    for (const id of this.connectedViewerIds()) this.deps.send(id, message);
  }

  private connectedViewerIds(): string[] {
    return [
      ...this.players.filter((p) => p.connected).map((p) => p.id),
      ...[...this.audience.values()].filter((m) => m.connected).map((m) => m.id),
    ];
  }
}

const GAME_MODES: readonly GameMode[] = ['classic', 'custom', 'doodle', 'context', 'initials'];
const TIMER_SPEEDS: readonly TimerSpeed[] = ['normal', 'relaxed', 'off'];
const GAME_LENGTHS: readonly GameLength[] = ['full', 'short'];

function isGameMode(value: unknown): value is GameMode {
  return GAME_MODES.includes(value as GameMode);
}

function isTimerSpeed(value: unknown): value is TimerSpeed {
  return TIMER_SPEEDS.includes(value as TimerSpeed);
}

function isGameLength(value: unknown): value is GameLength {
  return GAME_LENGTHS.includes(value as GameLength);
}

/** A short game goes from round 1 straight to the final. */
function nextRound(current: RoundIndex, length: GameLength): RoundIndex {
  if (current === 0 && length === 'short') return FINAL_ROUND;
  return (current + 1) as RoundIndex;
}

/** Artists and twisters stay anonymous until the reveal; a post's victim is the point of it. */
function publicSeed(prompt: DealtPrompt, revealed: boolean): PublicSeed | null {
  const { post, seed } = prompt;
  if (post) {
    return {
      kind: 'post',
      postId: post.id,
      victimId: post.victimId,
      quote: post.quote,
      site: post.site,
      twisterId: revealed ? post.twisterId : null,
    };
  }
  if (seed?.kind === 'drawing') {
    return { kind: 'drawing', drawingId: prompt.id, artistId: revealed ? seed.authorId : null };
  }
  return null;
}

/** Longer answers get more time on screen: 6 s base, +1 s per 40 chars past 80, max 10 s. */
export function revealDuration(combinedChars: number): number {
  const extra =
    Math.max(0, Math.ceil((combinedChars - 80) / 40)) * TIMERS.MATCHUP_REVEAL_PER_40_CHARS;
  return Math.min(TIMERS.MATCHUP_REVEAL + extra, TIMERS.MATCHUP_REVEAL_MAX);
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
