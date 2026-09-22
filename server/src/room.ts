import {
  AUTO_SUBMIT_TEXT,
  CHARACTER_IDS,
  FINAL_ROUND,
  LEFT_TEXT,
  LIMITS,
  LOBBY_HOLD_MS,
  RECONNECT_HOLD_MS,
  TIMERS,
  computePlacements,
  computeSuperlatives,
  roundSpec,
  scoreFinal,
  scoreMatchup,
  validateAnswer,
  type AnswerMode,
  type CustomPrompt,
  type ErrorCode,
  type MatchupResult,
  type PlayerStats,
  type Prompt,
  type PublicAnswer,
  type PublicMatchup,
  type PublicPlayer,
  type PublicRoomState,
  type Roast,
  type RoomPhase,
  type RoomSettings,
  type RoundIndex,
  type ServerMessage,
  type YourPrompt,
} from './shared.ts';
import type { PromptDeck } from './prompts.ts';

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
  connectedSince: number;
  joinedAt: number;
  score: number;
  roastTokens: number;
  stats: PlayerStats;
  removalTimer: ReturnType<typeof setTimeout> | null;
}

interface Answer {
  playerId: string;
  text: string;
  wordCount: number;
  autoSubmitted: boolean;
  effectiveLimit: number;
}

interface Matchup {
  prompt: Prompt;
  playerIds: [string, string];
  answers: [Answer | null, Answer | null];
  votes: Record<string, 0 | 1>;
  roast: Roast | null;
  result: MatchupResult | null;
  revealed: boolean;
}

interface FinalRound {
  prompt: Prompt;
  mode: AnswerMode;
  limit: number;
  answers: Map<string, Answer>;
  votes: Record<string, [string, string]>;
  result: Record<string, { first: number; second: number; points: number }> | null;
}

export interface RoomDeps {
  deck: PromptDeck;
  send: (playerId: string, message: ServerMessage) => void;
  random?: () => number;
  onEmpty?: (room: Room) => void;
}

function freshStats(): PlayerStats {
  return {
    micDrops: 0,
    silenced: 0,
    roasted: 0,
    wordsUsedTotal: 0,
    submissions: 0,
    submitMsTotal: 0,
  };
}

export function sanitizeName(raw: string): string {
  return raw
    .replace(/[\p{C}]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, LIMITS.NAME_MAX);
}

export class Room {
  phase: RoomPhase = 'LOBBY';
  phaseEndsAt: number | null = null;
  phaseStartedAt: number;
  roundIndex: RoundIndex = 0;
  leaderId = '';
  settings: RoomSettings = { profanityFilter: false, emojiFinal: 'off', promptMode: 'bank' };
  gamesPlayed = 0;
  banner: string | null = null;

  readonly players: Player[] = [];
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

  get isClosed(): boolean {
    return this.closed;
  }

  hasPlayer(playerId: string): boolean {
    return this.players.some((p) => p.id === playerId);
  }

  close(): void {
    this.closed = true;
    this.clearTimer();
    if (this.roastTimer) clearTimeout(this.roastTimer);
    for (const player of this.players) {
      if (player.removalTimer) clearTimeout(player.removalTimer);
    }
  }

  // ------------------------------------------------------------- join / leave

  addPlayer(playerId: string, rawName: string): void {
    if (this.phase !== 'LOBBY')
      throw new RoomError('bad_phase', 'That game is already in progress');
    if (this.players.length >= LIMITS.MAX_PLAYERS) throw new RoomError('room_full', 'Room is full');
    const name = this.uniqueName(sanitizeName(rawName));
    if (name.length === 0)
      throw new RoomError('bad_name', 'Pick a name between 1 and 12 characters');
    const now = Date.now();
    this.players.push({
      id: playerId,
      name,
      characterId: null,
      connected: true,
      connectedSince: now,
      joinedAt: now,
      score: 0,
      roastTokens: LIMITS.ROAST_TOKENS_PER_GAME,
      stats: freshStats(),
      removalTimer: null,
    });
    if (!this.leaderId) this.leaderId = playerId;
    this.broadcast();
  }

  /** Re-attach a returning player (their id was proven by a session token). */
  reconnect(playerId: string): void {
    const player = this.requirePlayer(playerId);
    if (player.removalTimer) {
      clearTimeout(player.removalTimer);
      player.removalTimer = null;
    }
    const wasConnected = player.connected;
    player.connected = true;
    if (!wasConnected) player.connectedSince = Date.now();
    this.broadcast();
    this.sendPrivateState(playerId);
  }

  disconnect(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.connected) return;
    player.connected = false;
    if (this.leaderId === playerId) this.passLeadership();
    const hold = this.phase === 'LOBBY' ? LOBBY_HOLD_MS : RECONNECT_HOLD_MS;
    player.removalTimer = setTimeout(() => this.expireSlot(playerId), hold);
    this.afterPresenceChange();
    this.broadcast();
    if (this.connectedCount === 0) this.deps.onEmpty?.(this);
  }

  leave(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;
    if (this.phase === 'LOBBY' || this.phase === 'PODIUM') {
      this.removePlayer(playerId);
    } else {
      this.disconnect(playerId);
    }
    if (this.connectedCount === 0) this.deps.onEmpty?.(this);
  }

  private expireSlot(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.connected) return;
    player.removalTimer = null;
    if (this.phase === 'LOBBY' || this.phase === 'PODIUM') this.removePlayer(playerId);
  }

  private removePlayer(playerId: string): void {
    const index = this.players.findIndex((p) => p.id === playerId);
    if (index === -1) return;
    const [player] = this.players.splice(index, 1);
    if (player?.removalTimer) clearTimeout(player.removalTimer);
    if (this.leaderId === playerId) this.passLeadership();
    this.broadcast();
  }

  private passLeadership(): void {
    const candidates = this.players
      .filter((p) => p.connected && p.id !== this.leaderId)
      .sort((a, b) => a.connectedSince - b.connectedSince);
    const next = candidates[0] ?? this.players.find((p) => p.id !== this.leaderId) ?? null;
    if (!next) {
      this.leaderId = this.players[0]?.id ?? '';
      return;
    }
    this.leaderId = next.id;
    this.banner = `${next.name} is now the leader`;
  }

  private uniqueName(base: string): string {
    if (base.length === 0) return base;
    const taken = new Set(this.players.map((p) => p.name.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let n = 2; n < 100; n++) {
      const suffix = ` (${n})`;
      const candidate = base.slice(0, LIMITS.NAME_MAX - suffix.length).trimEnd() + suffix;
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
    if (patch.emojiFinal === 'off' || patch.emojiFinal === 'always') {
      this.settings.emojiFinal = patch.emojiFinal;
    }
    if (patch.promptMode === 'bank' || patch.promptMode === 'custom') {
      this.settings.promptMode = patch.promptMode;
    }
    this.broadcast();
  }

  /** Any player may add prompts in the lobby; they are dealt first in custom mode. */
  addPrompt(playerId: string, rawText: string): void {
    this.requirePhase('LOBBY');
    this.requirePlayer(playerId);
    const text = rawText
      .replace(/[\p{C}]/gu, '')
      .trim()
      .replace(/\s+/g, ' ');
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
    this.requirePlayer(playerId);
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
    for (const player of [...this.players]) {
      if (!player.connected) this.removePlayer(player.id);
    }
    if (this.players.length < LIMITS.MIN_PLAYERS) {
      throw new RoomError('not_enough_players', `Need at least ${LIMITS.MIN_PLAYERS} players`);
    }
    this.banner = null;
    for (const player of this.players) {
      player.score = 0;
      player.roastTokens = LIMITS.ROAST_TOKENS_PER_GAME;
      player.stats = freshStats();
    }
    this.podium = null;
    this.final = null;
    this.matchups = [];
    // Characters are picked in the lobby; anyone who did not pick gets a random leftover.
    this.assignMissingCharacters();
    this.beginRound(0);
  }

  /** Lobby pick, first come first served; picking again swaps to the new character. */
  pickCharacter(playerId: string, characterId: string): void {
    this.requirePhase('LOBBY');
    const player = this.requirePlayer(playerId);
    if (!CHARACTER_IDS.includes(characterId)) throw new RoomError('invalid', 'Unknown character');
    const owner = this.players.find((p) => p.characterId === characterId);
    if (owner && owner.id !== playerId)
      throw new RoomError('char_taken', 'Someone grabbed that one first');
    player.characterId = characterId;
    this.broadcast();
  }

  spendRoast(playerId: string, targetId: string): void {
    this.requirePhase('WRITING');
    const spender = this.requirePlayer(playerId);
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
    const matchup = this.matchups.find((m) => m.playerIds.includes(targetId));
    if (!matchup) throw new RoomError('invalid', 'That player has no prompt this round');
    matchup.roast = { spenderId: playerId, targetId };
    spender.roastTokens -= 1;
    target.stats.roasted += 1;
    this.broadcast();
    this.deps.send(targetId, { type: 'roasted', payload: { byName: spender.name } });
  }

  submitAnswer(playerId: string, promptId: string, rawText: string): void {
    const player = this.requirePlayer(playerId);
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
      const limit =
        matchup.roast?.targetId === playerId
          ? LIMITS.ROASTED_LIMIT
          : roundSpec(this.roundIndex).limit;
      matchup.answers[slot] = this.buildAnswer(player, rawText, limit, 'words');
      this.recordSubmission(player, matchup.answers[slot]);
      if (this.allWritingDone()) this.endWriting();
      else {
        this.broadcast();
        this.sendPrivateState(playerId);
      }
      return;
    }
    if (this.phase === 'FINAL_WRITING' && this.final) {
      if (this.final.prompt.id !== promptId)
        throw new RoomError('invalid', 'That prompt is not yours');
      if (this.final.answers.has(playerId))
        throw new RoomError('already_submitted', 'You already answered');
      const answer = this.buildAnswer(player, rawText, this.final.limit, this.final.mode);
      this.final.answers.set(playerId, answer);
      this.recordSubmission(player, answer);
      if (this.allWritingDone()) this.endWriting();
      else {
        this.broadcast();
        this.sendPrivateState(playerId);
      }
      return;
    }
    throw new RoomError('bad_phase', 'Nobody is writing right now');
  }

  castVote(playerId: string, matchupIndex: number, answerIndex: 0 | 1): void {
    this.requirePhase('VOTING');
    this.requirePlayer(playerId);
    if (matchupIndex !== this.currentMatchupIndex)
      throw new RoomError('bad_phase', 'That matchup is not open');
    const matchup = this.currentMatchup();
    if (matchup.playerIds.includes(playerId))
      throw new RoomError('invalid', 'You cannot vote on your own matchup');
    if (answerIndex !== 0 && answerIndex !== 1)
      throw new RoomError('invalid', 'Pick one of the two answers');
    if (playerId in matchup.votes) throw new RoomError('already_submitted', 'You already voted');
    matchup.votes[playerId] = answerIndex;
    if (this.allVotesIn()) this.revealMatchup();
    else this.broadcast();
  }

  castFinalVotes(playerId: string, first: string, second: string): void {
    this.requirePhase('FINAL_VOTING');
    this.requirePlayer(playerId);
    const final = this.final;
    if (!final) throw new RoomError('bad_phase', 'No final round');
    if (first === second) throw new RoomError('invalid', 'Pick two different answers');
    if (first === playerId || second === playerId)
      throw new RoomError('invalid', 'You cannot vote for yourself');
    if (!final.answers.has(first) || !final.answers.has(second))
      throw new RoomError('invalid', 'Unknown answer');
    if (playerId in final.votes) throw new RoomError('already_submitted', 'You already voted');
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
    this.banner = null;
    this.enterPhase('LOBBY', null);
  }

  // ------------------------------------------------------------ state machine

  private beginRound(index: RoundIndex): void {
    this.roundIndex = index;
    this.currentMatchupIndex = 0;
    this.roastWindowEndsAt = null;
    this.promptsDealt = false;
    if (index === FINAL_ROUND) {
      const prompt = this.drawPrompts(FINAL_ROUND, 1)[0]!;
      const mode = this.pickFinalMode();
      this.final = {
        prompt,
        mode,
        limit: mode === 'emoji' ? LIMITS.MAX_EMOJI : roundSpec(FINAL_ROUND).limit,
        answers: new Map(),
        votes: {},
        result: null,
      };
      this.matchups = [];
    } else {
      this.matchups = this.generateMatchups(index);
    }
    this.enterPhase('ROUND_INTRO', TIMERS.ROUND_INTRO);
  }

  private pickFinalMode(): AnswerMode {
    switch (this.settings.emojiFinal) {
      case 'always':
        return 'emoji';
      default:
        return 'words';
    }
  }

  /** Custom prompts first (shuffled, unused), then the bank for any shortfall. */
  private drawPrompts(round: RoundIndex, count: number): Prompt[] {
    const picked: Prompt[] = [];
    if (this.settings.promptMode === 'custom') {
      const fresh = this.shuffled(this.customPrompts.filter((p) => !this.usedPromptIds.has(p.id)));
      for (const prompt of fresh.slice(0, count)) {
        this.usedPromptIds.add(prompt.id);
        picked.push({ id: prompt.id, text: prompt.text, rounds: [0, 1, 2] });
      }
    }
    if (picked.length < count) {
      picked.push(...this.deps.deck.draw(round, count - picked.length, this.usedPromptIds));
    }
    return picked;
  }

  /**
   * Ring pairing: player i vs player i+1 (mod N) gets prompt i; N matchups. Prompts are
   * then rotated so that, where possible, nobody answers a prompt they wrote.
   */
  private generateMatchups(round: RoundIndex): Matchup[] {
    const order = this.shuffled(this.players.map((p) => p.id));
    const drawn = this.drawPrompts(round, order.length);
    const pairs = order.map(
      (playerId, i) => [playerId, order[(i + 1) % order.length]!] as [string, string],
    );
    const authorOf = new Map(this.customPrompts.map((p) => [p.id, p.authorId]));
    const collisions = (offset: number) =>
      pairs.filter((pair, i) =>
        pair.includes(authorOf.get(drawn[(i + offset) % drawn.length]!.id) ?? ''),
      ).length;
    let bestOffset = 0;
    for (let offset = 1; offset < drawn.length; offset++) {
      if (collisions(offset) < collisions(bestOffset)) bestOffset = offset;
    }
    const prompts = drawn.map((_, i) => drawn[(i + bestOffset) % drawn.length]!);
    return order.map((playerId, i) => ({
      prompt: prompts[i]!,
      playerIds: pairs[i]!,
      answers: [null, null],
      votes: {},
      roast: null,
      result: null,
      revealed: false,
    }));
  }

  private startWriting(): void {
    const spec = roundSpec(this.roundIndex);
    if (this.roundIndex === FINAL_ROUND) {
      this.enterPhase('FINAL_WRITING', spec.writingMs);
      this.dealPrompts();
      return;
    }
    this.enterPhase('WRITING', spec.writingMs);
    if (this.roundIndex >= LIMITS.ROAST_FROM_ROUND) {
      this.roastWindowEndsAt = Date.now() + TIMERS.ROAST_WINDOW;
      this.roastTimer = setTimeout(() => {
        this.roastTimer = null;
        this.roastWindowEndsAt = null;
        this.dealPrompts();
      }, TIMERS.ROAST_WINDOW);
      this.broadcast();
    } else {
      this.dealPrompts();
    }
  }

  private dealPrompts(): void {
    this.promptsDealt = true;
    this.promptsDealtAt = Date.now();
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
      for (const player of this.players) {
        if (!this.final.answers.has(player.id)) {
          this.final.answers.set(player.id, this.fallbackAnswer(player, this.final.limit));
        }
      }
      this.enterPhase('FINAL_VOTING', TIMERS.FINAL_VOTING);
      if (this.allFinalVotesIn()) this.finishFinal();
      return;
    }
    for (const matchup of this.matchups) {
      matchup.playerIds.forEach((playerId, slot) => {
        if (!matchup.answers[slot]) {
          const limit =
            matchup.roast?.targetId === playerId
              ? LIMITS.ROASTED_LIMIT
              : roundSpec(this.roundIndex).limit;
          matchup.answers[slot] = this.fallbackAnswer(this.requirePlayer(playerId), limit);
        }
      });
    }
    this.currentMatchupIndex = 0;
    this.startVoting();
  }

  private startVoting(): void {
    this.enterPhase('VOTING', TIMERS.VOTING);
    if (this.allVotesIn()) this.revealMatchup();
  }

  private revealMatchup(): void {
    const matchup = this.currentMatchup();
    const [a, b] = matchup.answers;
    if (!a || !b) throw new Error('Cannot reveal a matchup with missing answers');
    const result = scoreMatchup({
      answers: [a, b],
      votes: matchup.votes,
      roast: matchup.roast,
      multiplier: roundSpec(this.roundIndex).multiplier,
    });
    for (const [playerId, delta] of Object.entries(result.delta)) {
      this.requirePlayer(playerId).score += delta;
    }
    for (const award of result.awards) {
      if (award.kind === 'micDrop') this.requirePlayer(award.playerId).stats.micDrops += 1;
      if (award.kind === 'silenced') this.requirePlayer(award.playerId).stats.silenced += 1;
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
      this.enterPhase('ROUND_RESULTS', TIMERS.ROUND_RESULTS);
    }
  }

  private finishFinal(): void {
    const final = this.final;
    if (!final) throw new Error('finishFinal without a final round');
    final.result = scoreFinal(
      final.votes,
      this.players.map((p) => p.id),
      roundSpec(FINAL_ROUND).multiplier,
    );
    for (const [playerId, tally] of Object.entries(final.result)) {
      const player = this.players.find((p) => p.id === playerId);
      if (player) player.score += tally.points;
    }
    const publicPlayers = this.players.map((p) => this.publicPlayer(p));
    this.podium = {
      placements: computePlacements(publicPlayers),
      superlatives: computeSuperlatives(publicPlayers),
    };
    this.enterPhase('PODIUM', null);
  }

  private onPhaseTimeout(): void {
    switch (this.phase) {
      case 'ROUND_INTRO':
        this.startWriting();
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
        this.beginRound((this.roundIndex + 1) as RoundIndex);
        return;
      case 'FINAL_VOTING':
        this.finishFinal();
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
    if (durationMs !== null) {
      this.phaseTimer = setTimeout(() => {
        this.phaseTimer = null;
        this.onPhaseTimeout();
      }, durationMs);
    }
    this.broadcast();
  }

  private clearTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  /** A disconnect can be the last thing a phase was waiting on. */
  private afterPresenceChange(): void {
    if ((this.phase === 'WRITING' && this.promptsDealt) || this.phase === 'FINAL_WRITING') {
      if (this.allWritingDone()) this.endWriting();
    } else if (this.phase === 'VOTING') {
      if (this.allVotesIn()) this.revealMatchup();
    } else if (this.phase === 'FINAL_VOTING') {
      if (this.allFinalVotesIn()) this.finishFinal();
    }
  }

  // ------------------------------------------------------------------ helpers

  private assignMissingCharacters(): void {
    const free = this.shuffled(
      CHARACTER_IDS.filter((id) => !this.players.some((p) => p.characterId === id)),
    );
    for (const player of this.players) {
      if (player.characterId === null) player.characterId = free.pop() ?? null;
    }
  }

  private buildAnswer(player: Player, rawText: string, limit: number, mode: AnswerMode): Answer {
    const validation = validateAnswer(rawText, limit, mode);
    if (!validation.ok) {
      const messages: Record<string, string> = {
        over_limit: `That's over the ${limit}-${mode === 'emoji' ? 'emoji' : 'word'} limit`,
        too_long: `Keep it under ${LIMITS.MAX_CHARS} characters`,
        empty: 'Say something. Anything.',
        invalid_chars: 'Emoji only in this round',
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
    };
  }

  private fallbackAnswer(player: Player, limit: number): Answer {
    return {
      playerId: player.id,
      text: player.connected ? AUTO_SUBMIT_TEXT : LEFT_TEXT,
      wordCount: 0,
      autoSubmitted: true,
      effectiveLimit: limit,
    };
  }

  private recordSubmission(player: Player, answer: Answer): void {
    player.stats.wordsUsedTotal += answer.wordCount;
    player.stats.submissions += 1;
    player.stats.submitMsTotal += Math.max(Date.now() - this.promptsDealtAt, 0);
  }

  private allWritingDone(): boolean {
    if (this.phase === 'FINAL_WRITING' && this.final) {
      return this.players.every((p) => !p.connected || this.final!.answers.has(p.id));
    }
    return this.matchups.every((m) =>
      m.playerIds.every((id, slot) => m.answers[slot] !== null || !this.isConnected(id)),
    );
  }

  private eligibleVoters(matchup: Matchup): Player[] {
    return this.players.filter((p) => p.connected && !matchup.playerIds.includes(p.id));
  }

  private allVotesIn(): boolean {
    const matchup = this.currentMatchup();
    return this.eligibleVoters(matchup).every((p) => p.id in matchup.votes);
  }

  private allFinalVotesIn(): boolean {
    const final = this.final;
    if (!final) return true;
    return this.players.filter((p) => p.connected).every((p) => p.id in final.votes);
  }

  private currentMatchup(): Matchup {
    const matchup = this.matchups[this.currentMatchupIndex];
    if (!matchup) throw new Error(`No matchup at index ${this.currentMatchupIndex}`);
    return matchup;
  }

  private isConnected(playerId: string): boolean {
    return this.players.find((p) => p.id === playerId)?.connected ?? false;
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
      customPrompts: this.customPrompts.map((p) => ({ ...p })),
      matchups: this.matchups.map((m, i) => this.publicMatchup(m, i)),
      currentMatchupIndex: this.currentMatchupIndex,
      roastWindowEndsAt: this.roastWindowEndsAt,
      submittedIds: this.submittedIds(),
      votedIds: this.votedIds(),
      final: this.publicFinal(),
      podium: this.podium,
      banner: this.banner,
      gamesPlayed: this.gamesPlayed,
      serverNow: now,
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
          promptId: m.prompt.id,
          text: m.prompt.text,
          effectiveLimit:
            m.roast?.targetId === playerId
              ? LIMITS.ROASTED_LIMIT
              : roundSpec(this.roundIndex).limit,
          mode: 'words',
          matchupIndex,
          submittedText: m.answers[slot as 0 | 1]?.text ?? null,
        });
      });
      return prompts;
    }
    if (this.phase === 'FINAL_WRITING' && this.final) {
      return [
        {
          promptId: this.final.prompt.id,
          text: this.final.prompt.text,
          effectiveLimit: this.final.limit,
          mode: this.final.mode,
          matchupIndex: null,
          submittedText: this.final.answers.get(playerId)?.text ?? null,
        },
      ];
    }
    return [];
  }

  private sendPrivateState(playerId: string): void {
    const prompts = this.yourPrompts(playerId);
    if (prompts.length > 0)
      this.deps.send(playerId, { type: 'your_prompts', payload: { prompts } });
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
      roastTokens: p.roastTokens,
      stats: { ...p.stats },
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
    });
    return {
      promptId: m.prompt.id,
      promptText: votingOpen ? m.prompt.text : '',
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
    const votingOpen = this.phase === 'FINAL_VOTING' || this.phase === 'PODIUM';
    const revealed = this.phase === 'PODIUM';
    // Final votes are cast by player id, so authorship is public once the wall opens.
    const answers: PublicAnswer[] = votingOpen
      ? this.shuffledStable([...final.answers.values()]).map((answer) => ({
          playerId: answer.playerId,
          text: answer.text,
          wordCount: revealed ? answer.wordCount : null,
          autoSubmitted: answer.autoSubmitted,
          effectiveLimit: revealed ? answer.effectiveLimit : null,
        }))
      : [];
    return {
      prompt: { id: final.prompt.id, text: final.prompt.text },
      mode: final.mode,
      limit: final.limit,
      answers,
      votes: revealed ? { ...final.votes } : null,
      result: final.result,
    };
  }

  /** Deterministic order per room so every client sees the same card wall. */
  private shuffledStable<T extends { playerId: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => hash(a.playerId + this.code) - hash(b.playerId + this.code));
  }

  private submittedIds(): string[] {
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
    if (this.phase === 'FINAL_WRITING' && this.final) return [...this.final.answers.keys()];
    return [];
  }

  private votedIds(): string[] {
    if (this.phase === 'VOTING') return Object.keys(this.currentMatchup().votes);
    if (this.phase === 'FINAL_VOTING' && this.final) return Object.keys(this.final.votes);
    return [];
  }

  private broadcast(): void {
    if (this.closed) return;
    this.broadcastAll({ type: 'room_state', payload: this.publicState() });
  }

  private broadcastAll(message: ServerMessage): void {
    for (const player of this.players) {
      if (player.connected) this.deps.send(player.id, message);
    }
  }
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
