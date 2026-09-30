import type { RoundIndex } from './types.ts';

export interface RoundSpec {
  index: RoundIndex;
  name: string;
  limit: number;
  writingMs: number;
  multiplier: number;
}

export const ROUNDS: readonly RoundSpec[] = [
  { index: 0, name: 'Say Some', limit: 12, writingMs: 120_000, multiplier: 1 },
  { index: 1, name: 'Say Less', limit: 6, writingMs: 120_000, multiplier: 1.5 },
  { index: 2, name: 'Say Nothing… Almost', limit: 3, writingMs: 60_000, multiplier: 2 },
];

export const FINAL_ROUND: RoundIndex = 2;

export const TIMERS = {
  ROUND_INTRO: 4_000,
  ROAST_WINDOW: 10_000,
  VOTING: 20_000,
  MATCHUP_REVEAL: 6_000,
  /** extra reveal time per 40 characters of combined answer text beyond 80, capped */
  MATCHUP_REVEAL_PER_40_CHARS: 1_000,
  MATCHUP_REVEAL_MAX: 10_000,
  ROUND_RESULTS: 8_000,
  FINAL_VOTING: 25_000,
  DRAWING: 75_000,
  CONFESSING: 45_000,
  /** "The votes are in…" before the first final answer is revealed */
  FINAL_REVEAL_LEAD: 2_000,
  /** answers outside the final top three go by quickly */
  FINAL_REVEAL_FAST: 2_000,
  FINAL_REVEAL_SLOW: 4_500,
  /** time on the winning answer before the podium */
  FINAL_REVEAL_HOLD: 4_000,
} as const;

export const LIMITS = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 12,
  NAME_MAX: 12,
  MAX_CHARS: 120,
  ROASTED_LIMIT: 2,
  ROAST_TOKENS_PER_GAME: 1,
  ROAST_FROM_ROUND: 1 as RoundIndex,
  PROMPT_MAX_CHARS: 120,
  MAX_CUSTOM_PROMPTS: 60,
  /** Burn Book's honest answer about yourself */
  CONFESSION_WORDS: 8,
  /** the drawing message is the one frame allowed past the usual 4 KiB */
  MAX_DRAWING_MESSAGE: 32_768,
  /** per client address (IPv4, or IPv6 /64): a whole household shares one */
  MAX_LIVE_ROOMS_PER_CLIENT: 5,
  ROOM_CREATIONS_PER_WINDOW: 10,
} as const;

export const POINTS = {
  VOTE: 100,
  SILENCED: 250,
  SILENCED_MIN_VOTES: 2,
  MIC_DROP: 200,
  /** a Mic Drop needs strictly more than this share of the votes */
  MIC_DROP_VOTE_SHARE: 0.5,
  MIC_DROP_MIN_VOTES: 2,
  GREAT_MINDS: 100,
  FINAL_FIRST: 200,
  FINAL_SECOND: 100,
} as const;

export const AUTO_SUBMIT_TEXT = '…';
export const LEFT_TEXT = '[left the chat]';

export const RECONNECT_HOLD_MS = 3 * 60_000;
/** A player dropped for less than this still counts as playing (an app switch, not a dead phone). */
export const DISCONNECT_GRACE_MS = 15_000;
export const LOBBY_HOLD_MS = 30_000;
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;
/** an emptied lobby that never started a game */
export const EMPTY_LOBBY_TTL_MS = 60_000;
export const ROOM_CREATION_WINDOW_MS = 10 * 60_000;
export const MAX_ROOMS = 300;
export const RATE_LIMIT_MS = 250;

/**
 * When each final answer is revealed, in ms after FINAL_REVEAL starts, lowest score first.
 * The top three get the slow reveal; the rest go quickly.
 */
export function finalRevealSchedule(count: number): { starts: number[]; totalMs: number } {
  const starts: number[] = [];
  let at: number = TIMERS.FINAL_REVEAL_LEAD;
  for (let i = 0; i < count; i++) {
    starts.push(at);
    at += count - i <= 3 ? TIMERS.FINAL_REVEAL_SLOW : TIMERS.FINAL_REVEAL_FAST;
  }
  return { starts, totalMs: at + TIMERS.FINAL_REVEAL_HOLD };
}

export function roundSpec(index: RoundIndex): RoundSpec {
  const spec = ROUNDS[index];
  if (!spec) throw new Error(`No round spec for index ${index}`);
  return spec;
}
