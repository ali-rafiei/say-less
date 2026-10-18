import { LIMITS } from './constants.ts';

/** Punctuation, combining marks and invisible format characters on their own are not a word. */
const NOT_A_WORD = /^[\p{P}\p{M}\p{Cc}\p{Cf}\s]*$/u;
/** Braille blank and Hangul fillers render as blank space but are not \s. */
const BLANK_LOOKALIKES = /[\u115F\u1160\u2800\u3164\uFFA0]/gu;

export function normalizeWhitespace(text: string): string {
  return text.replace(BLANK_LOOKALIKES, ' ').trim().replace(/\s+/g, ' ');
}

/** Tokens that count as words: whitespace-split, tokens with nothing visible dropped. */
export function words(text: string): string[] {
  const normalized = normalizeWhitespace(text);
  if (normalized === '') return [];
  return normalized.split(' ').filter((token) => !NOT_A_WORD.test(token));
}

export function countWords(text: string): number {
  return words(text).length;
}

export type AnswerError = 'empty' | 'too_long' | 'over_limit' | 'bad_initials';

export interface AnswerValidation {
  ok: boolean;
  count: number;
  error: AnswerError | null;
  text: string;
}

/**
 * The authoritative rule set, run identically on client and server. A null limit is no limit.
 * With `letters` (Initials mode) the answer needs exactly one word per letter, each starting
 * with its letter in order.
 */
export function validateAnswer(
  raw: string,
  limit: number | null,
  letters: string | null = null,
): AnswerValidation {
  const text = normalizeWhitespace(raw);
  if (text.length > LIMITS.MAX_CHARS) {
    return { ok: false, count: 0, error: 'too_long', text };
  }
  const count = countWords(text);
  if (count === 0) return { ok: false, count, error: 'empty', text };
  if (limit !== null && count > limit) return { ok: false, count, error: 'over_limit', text };
  if (letters !== null && !initialsMatched(text, letters).every(Boolean)) {
    return { ok: false, count, error: 'bad_initials', text };
  }
  return { ok: true, count, error: null, text };
}

/** Per letter: whether the word in that position starts with it. */
export function initialsMatched(text: string, letters: string): boolean[] {
  const tokens = words(text);
  return Array.from(letters).map((letter, i) => {
    const token = tokens[i];
    return token !== undefined && firstLetter(token) === letter.toUpperCase();
  });
}

/** The first letter or digit of a word, uppercased without accents ("Élan" -> "E"). */
function firstLetter(token: string): string {
  const match = token.normalize('NFD').match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : '';
}

/** Used to detect "GREAT MINDS" (identical answers). */
export function normalizeForComparison(text: string): string {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[\p{P}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
