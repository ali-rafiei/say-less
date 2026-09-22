import { describe, expect, it } from 'vitest';
import { analyzeEmoji, countWords, normalizeForComparison, validateAnswer } from '../src/words.ts';

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
});

describe('analyzeEmoji', () => {
  it('counts flags, ZWJ families and skin tones as one grapheme each', () => {
    // Arrange: flag + family (ZWJ sequence) + thumbs up with skin tone
    const text = '🇨🇦👨‍👩‍👧‍👦👍🏽';
    // Act
    const { count, invalid } = analyzeEmoji(text);
    // Assert
    expect(count).toBe(3);
    expect(invalid).toEqual([]);
  });

  it('rejects letters and digits but accepts keycap sequences', () => {
    expect(analyzeEmoji('😀a').invalid).toEqual(['a']);
    expect(analyzeEmoji('😀 7').invalid).toEqual(['7']);
    expect(analyzeEmoji('1️⃣')).toEqual({ count: 1, invalid: [] });
  });

  it('ignores whitespace between emoji', () => {
    expect(analyzeEmoji('🔥 🔥  🔥').count).toBe(3);
  });
});

describe('validateAnswer', () => {
  it('accepts an answer at exactly the limit', () => {
    expect(validateAnswer('one two three four five six', 6, 'words').ok).toBe(true);
  });

  it('rejects one word over the limit with over_limit', () => {
    const result = validateAnswer('one two three four five six seven', 6, 'words');
    expect(result).toMatchObject({ ok: false, error: 'over_limit', count: 7 });
  });

  it('rejects more than 120 characters regardless of word count', () => {
    const wall = 'a'.repeat(121);
    expect(validateAnswer(wall, 12, 'words').error).toBe('too_long');
  });

  it('rejects an empty answer', () => {
    expect(validateAnswer('!!!', 12, 'words').error).toBe('empty');
  });

  it('enforces the 5 emoji limit and rejects letters in emoji mode', () => {
    expect(validateAnswer('😀😀😀😀😀', 5, 'emoji').ok).toBe(true);
    expect(validateAnswer('😀😀😀😀😀😀', 5, 'emoji').error).toBe('over_limit');
    expect(validateAnswer('😀 lol', 5, 'emoji').error).toBe('invalid_chars');
  });

  it('applies a roasted limit of 2 with the same rules', () => {
    expect(validateAnswer('just two', 2, 'words').ok).toBe(true);
    expect(validateAnswer('now three words', 2, 'words').error).toBe('over_limit');
  });
});

describe('normalizeForComparison', () => {
  it('treats case, punctuation and spacing differences as the same answer', () => {
    expect(normalizeForComparison('  Tax  Fraud!')).toBe(normalizeForComparison('tax fraud'));
  });
});
