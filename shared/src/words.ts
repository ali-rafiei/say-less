import { LIMITS } from './constants.ts';
import type { AnswerMode } from './types.ts';

const PUNCTUATION_ONLY = /^[\p{P}\s]*$/u;
const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\p{N}/u;
const EMOJI_BASE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

let segmenter: Intl.Segmenter | null = null;
function graphemes(text: string): string[] {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

export function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** Tokens that count as words: whitespace-split, punctuation-only tokens dropped. */
export function words(text: string): string[] {
  const normalized = normalizeWhitespace(text);
  if (normalized === '') return [];
  return normalized.split(' ').filter((token) => !PUNCTUATION_ONLY.test(token));
}

export function countWords(text: string): number {
  return words(text).length;
}

export function isEmojiGrapheme(grapheme: string): boolean {
  if (HAS_LETTER.test(grapheme)) return false;
  if (HAS_DIGIT.test(grapheme) && !grapheme.includes('⃣')) return false;
  return EMOJI_BASE.test(grapheme);
}

export interface EmojiAnalysis {
  count: number;
  invalid: string[];
}

/** Counts emoji graphemes (flags, ZWJ families and skin tones each count as 1). */
export function analyzeEmoji(text: string): EmojiAnalysis {
  const invalid: string[] = [];
  let count = 0;
  for (const grapheme of graphemes(text)) {
    if (/^\s+$/u.test(grapheme) || grapheme === '️') continue;
    if (isEmojiGrapheme(grapheme)) count += 1;
    else invalid.push(grapheme);
  }
  return { count, invalid };
}

export function countEmoji(text: string): number {
  return analyzeEmoji(text).count;
}

export type AnswerError = 'empty' | 'too_long' | 'over_limit' | 'invalid_chars';

export interface AnswerValidation {
  ok: boolean;
  count: number;
  error: AnswerError | null;
  text: string;
}

/** The authoritative rule set, run identically on client and server. */
export function validateAnswer(raw: string, limit: number, mode: AnswerMode): AnswerValidation {
  const text = normalizeWhitespace(raw);
  if (text.length > LIMITS.MAX_CHARS) {
    return { ok: false, count: 0, error: 'too_long', text };
  }
  if (mode === 'emoji') {
    const { count, invalid } = analyzeEmoji(text);
    if (invalid.length > 0) return { ok: false, count, error: 'invalid_chars', text };
    if (count === 0) return { ok: false, count, error: 'empty', text };
    if (count > limit) return { ok: false, count, error: 'over_limit', text };
    return { ok: true, count, error: null, text };
  }
  const count = countWords(text);
  if (count === 0) return { ok: false, count, error: 'empty', text };
  if (count > limit) return { ok: false, count, error: 'over_limit', text };
  return { ok: true, count, error: null, text };
}

export function countUnits(text: string, mode: AnswerMode): number {
  return mode === 'emoji' ? countEmoji(text) : countWords(text);
}

/** Used to detect "GREAT MINDS" (identical answers). */
export function normalizeForComparison(text: string): string {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[\p{P}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
