import { describe, expect, it } from 'vitest';
import { countWords, normalizeForComparison, validateAnswer } from '../src/words.ts';

describe('countWords', () => {
  it('trims, collapses whitespace and counts tokens', () => {
    expect(countWords('  hello   big   world ')).toBe(3);
  });

  it('counts hyphenated and apostrophe words as one word', () => {
    expect(countWords("mother-in-law's")).toBe(1);
  });

  it('does not count punctuation-only tokens', () => {
    expect(countWords('wow ... really ?!')).toBe(2);
    expect(countWords('…')).toBe(0);
  });

  it('returns 0 for empty input', () => {
    expect(countWords('   ')).toBe(0);
  });

  it('splits on blank characters that render as spaces', () => {
    // Arrange: Braille blank and Hangul fillers look like spaces but are not \s
    const disguised = ['one\u2800two', 'three\u3164four', 'five\uFFA0six'].join(' ');
    // Act / Assert
    expect(countWords(disguised)).toBe(6);
    expect(validateAnswer('one\u2800two\u2800three', 2).error).toBe('over_limit');
  });

  it('does not count tokens with nothing visible in them', () => {
    expect(countWords('\u200B')).toBe(0);
    expect(countWords('\u202E \u0301\u0301 real')).toBe(1);
    expect(validateAnswer('\u2800\u3164\u200B', 12).error).toBe('empty');
  });

  it('still counts an emoji ZWJ sequence as one word', () => {
    expect(countWords('👨‍👩‍👧 rules')).toBe(2);
  });
});

describe('validateAnswer', () => {
  it('accepts an answer at exactly the limit', () => {
    expect(validateAnswer('one two three four five six', 6).ok).toBe(true);
  });

  it('rejects one word over the limit with over_limit', () => {
    const result = validateAnswer('one two three four five six seven', 6);
    expect(result).toMatchObject({ ok: false, error: 'over_limit', count: 7 });
  });

  it('rejects more than 120 characters regardless of word count', () => {
    const wall = 'a'.repeat(121);
    expect(validateAnswer(wall, 12).error).toBe('too_long');
  });

  it('rejects an empty answer', () => {
    expect(validateAnswer('!!!', 12).error).toBe('empty');
  });

  it('accepts any number of words when there is no limit', () => {
    // Given 20 words and no word limit
    const long = Array.from({ length: 20 }, () => 'yes').join(' ');
    // Then it is accepted, and the character cap still applies
    expect(validateAnswer(long, null)).toMatchObject({ ok: true, count: 20 });
    expect(validateAnswer('a'.repeat(121), null).error).toBe('too_long');
  });

  it('applies a roasted limit of 2 with the same rules', () => {
    expect(validateAnswer('just two', 2).ok).toBe(true);
    expect(validateAnswer('now three words', 2).error).toBe('over_limit');
  });
});

describe('normalizeForComparison', () => {
  it('treats case, punctuation and spacing differences as the same answer', () => {
    expect(normalizeForComparison('  Tax  Fraud!')).toBe(normalizeForComparison('tax fraud'));
  });
});
