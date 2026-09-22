import type { RoundIndex } from './types.ts';

export interface RoundSpec {
  index: RoundIndex;
  name: string;
  limit: number;
  writingMs: number;
  multiplier: number;
}

export const ROUNDS: readonly RoundSpec[] = [
  { index: 0, name: 'Say Some', limit: 12, writingMs: 90_000, multiplier: 1 },
  { index: 1, name: 'Say Less', limit: 6, writingMs: 60_000, multiplier: 1.5 },
  { index: 2, name: 'Say Nothing… Almost', limit: 3, writingMs: 45_000, multiplier: 2 },
];

export const FINAL_ROUND: RoundIndex = 2;

export const TIMERS = {
  CHAR_SELECT: 45_000,
  ROUND_INTRO: 4_000,
  ROAST_WINDOW: 10_000,
  VOTING: 20_000,
  MATCHUP_REVEAL: 6_000,
  ROUND_RESULTS: 8_000,
  FINAL_VOTING: 25_000,
} as const;

export const LIMITS = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 8,
  NAME_MAX: 12,
  MAX_CHARS: 120,
  MAX_EMOJI: 5,
  ROASTED_LIMIT: 2,
  ROAST_TOKENS_PER_GAME: 1,
  ROAST_FROM_ROUND: 1 as RoundIndex,
} as const;

export const POINTS = {
  VOTE: 100,
  SILENCED: 250,
  SILENCED_MIN_VOTES: 2,
  MIC_DROP: 200,
  GREAT_MINDS: 100,
  FINAL_FIRST: 200,
  FINAL_SECOND: 100,
} as const;

export const AUTO_SUBMIT_TEXT = '…';
export const LEFT_TEXT = '[left the chat]';

export const RECONNECT_HOLD_MS = 3 * 60_000;
export const LOBBY_HOLD_MS = 30_000;
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;
export const RATE_LIMIT_MS = 250;
export const EMOJI_FINAL_CHANCE = 0.3;

export function roundSpec(index: RoundIndex): RoundSpec {
  const spec = ROUNDS[index];
  if (!spec) throw new Error(`No round spec for index ${index}`);
  return spec;
}
