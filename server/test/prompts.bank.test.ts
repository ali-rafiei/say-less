import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PromptDeck, type PromptBankFile } from '../src/prompts.ts';
import { LIMITS, normalizeForComparison, type RoundIndex } from '../src/shared.ts';

const BANK_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../content/prompts.json');

const MIN_PROMPTS = 300;
const MIN_PROMPTS_PER_ROUND: Record<RoundIndex, number> = { 0: 180, 1: 180, 2: 100 };
const MIN_TEXT_CHARS = 8;
const MAX_TEXT_CHARS = LIMITS.PROMPT_MAX_CHARS;
const NEAR_DUPLICATE_WORDS = 5;
const OPENING_WORDS = 2;
const MAX_PROMPTS_PER_OPENING = 8;
const ID_FORMAT = /^p\d{3}$/;
const KNOWN_ROUNDS: readonly RoundIndex[] = [0, 1, 2];
const BLANK = '___';
const ENDS_WITH_PUNCTUATION_OR_BLANK = /(?:[.?!:]"?|___)$/;
const UNDERSCORE_RUN = /_+/g;
const ELLIPSIS = /\.\.\.|…/;
const SMART_QUOTES = /[‘’‚‛“”„‟]/;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const RETIRED_IDS: readonly string[] = [
  'p012',
  'p046',
  'p056',
  'p116',
  'p132',
  'p166',
  'p179',
  'p180',
  'p183',
  'p186',
  'p191',
  'p216',
  'p236',
  'p243',
];
const BANNED_WORDS: readonly string[] = [
  'adidas',
  'amazon',
  'barbie',
  'beyonce',
  'bezos',
  'biden',
  'coca-cola',
  'disney',
  'einstein',
  'elvis',
  'facebook',
  'google',
  'hogwarts',
  'ikea',
  'instagram',
  'iphone',
  'kardashian',
  'lego',
  'marvel',
  'mcdonald',
  'musk',
  'netflix',
  'nike',
  'nintendo',
  'obama',
  'olympic',
  'oprah',
  'pepsi',
  'playstation',
  'pokemon',
  'putin',
  'shakespeare',
  'spotify',
  'starbucks',
  'tesla',
  'tiktok',
  'trump',
  'twitter',
  'uber',
  'walmart',
  'xbox',
  'youtube',
  'zuckerberg',
];

const { prompts } = JSON.parse(readFileSync(BANK_PATH, 'utf8')) as PromptBankFile;

describe('prompt bank size', () => {
  it(`holds at least ${MIN_PROMPTS} prompts`, () => {
    // Given the shipped bank
    // Then it covers rematches without repeating soon
    expect(prompts.length).toBeGreaterThanOrEqual(MIN_PROMPTS);
  });

  it.each(KNOWN_ROUNDS)('tags enough prompts for round %i', (round) => {
    // Given the prompts tagged for this round
    const tagged = prompts.filter((p) => p.rounds.includes(round));

    // Then there are at least the round's minimum
    expect(tagged.length).toBeGreaterThanOrEqual(MIN_PROMPTS_PER_ROUND[round]);
  });

  it('loads through PromptDeck with every prompt intact', () => {
    // When the server loads the bank the way it does at boot
    const deck = PromptDeck.fromFile(BANK_PATH);

    // Then no prompt is lost
    expect(deck.size).toBe(prompts.length);
  });
});

describe('prompt bank ids and rounds', () => {
  it('gives every prompt a unique id in the pNNN format', () => {
    // Given every id
    const ids = prompts.map((p) => p.id);

    // Then each matches the format and none repeats
    expect(ids.filter((id) => !ID_FORMAT.test(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never reuses a retired id', () => {
    // Given the ids removed in earlier editorial passes
    const retired = new Set(RETIRED_IDS);

    // Then no live prompt carries one
    expect(prompts.filter((p) => retired.has(p.id)).map((p) => p.id)).toEqual([]);
  });

  it('tags every prompt with a non-empty, strictly sorted set of known rounds', () => {
    // Given prompts whose rounds are empty, unknown, unsorted or repeated
    const badlyTagged = prompts.filter(
      (p) =>
        p.rounds.length === 0 ||
        p.rounds.some((r, i) => !KNOWN_ROUNDS.includes(r) || (i > 0 && r <= p.rounds[i - 1]!)),
    );

    // Then there are none
    expect(badlyTagged.map((p) => p.id)).toEqual([]);
  });
});

describe('prompt bank text', () => {
  it(`keeps every text between ${MIN_TEXT_CHARS} and ${MAX_TEXT_CHARS} characters`, () => {
    // Given prompts outside the length bounds
    const outOfBounds = prompts.filter(
      (p) => p.text.length < MIN_TEXT_CHARS || p.text.length > MAX_TEXT_CHARS,
    );

    // Then there are none
    expect(outOfBounds.map((p) => p.text)).toEqual([]);
  });

  it(`ends every text with punctuation or a ${BLANK} blank`, () => {
    // Given prompts with a dangling ending
    const dangling = prompts.filter((p) => !ENDS_WITH_PUNCTUATION_OR_BLANK.test(p.text));

    // Then there are none
    expect(dangling.map((p) => p.text)).toEqual([]);
  });

  it(`writes every blank as exactly ${BLANK} and never as an ellipsis`, () => {
    // Given prompts with a differently written blank
    const offConvention = prompts.filter(
      (p) =>
        ELLIPSIS.test(p.text) || (p.text.match(UNDERSCORE_RUN) ?? []).some((run) => run !== BLANK),
    );

    // Then there are none
    expect(offConvention.map((p) => p.text)).toEqual([]);
  });

  it('has no leading, trailing or doubled whitespace', () => {
    // Given prompts with untidy whitespace
    const untidy = prompts.filter((p) => p.text !== p.text.trim() || /\s{2}|[^\S ]/.test(p.text));

    // Then there are none
    expect(untidy.map((p) => p.text)).toEqual([]);
  });

  it('uses plain ASCII quotes and apostrophes, never smart ones', () => {
    // Given prompts with typographic quotes
    const smart = prompts.filter((p) => SMART_QUOTES.test(p.text));

    // Then there are none
    expect(smart.map((p) => p.text)).toEqual([]);
  });

  it('contains no emoji', () => {
    // Given prompts with emoji in the text
    const withEmoji = prompts.filter((p) => EMOJI.test(p.text));

    // Then there are none
    expect(withEmoji.map((p) => p.text)).toEqual([]);
  });

  it('mentions no real brand or public figure from the banned list', () => {
    // Given prompts naming a banned word, plural or possessive included
    const banned = prompts.filter((p) =>
      BANNED_WORDS.some((word) => new RegExp(`\\b${word}(?:'s|s)?\\b`, 'i').test(p.text)),
    );

    // Then there are none
    expect(banned.map((p) => p.text)).toEqual([]);
  });
});

describe('prompt bank variety', () => {
  it('has no two prompts with the same normalized text', () => {
    // When prompts are grouped by normalized text
    const groups = groupBy(prompts, (p) => normalizeForComparison(p.text));

    // Then every group holds one prompt
    expect(crowded(groups, 1)).toEqual([]);
  });

  it(`has no two prompts opening with the same ${NEAR_DUPLICATE_WORDS} words`, () => {
    // When prompts are grouped by their opening words
    const groups = groupBy(prompts, (p) => opening(p.text, NEAR_DUPLICATE_WORDS));

    // Then every group holds one prompt
    expect(crowded(groups, 1)).toEqual([]);
  });

  it(`lets at most ${MAX_PROMPTS_PER_OPENING} prompts share their first ${OPENING_WORDS} words`, () => {
    // When prompts are grouped by their first two words
    const groups = groupBy(prompts, (p) => opening(p.text, OPENING_WORDS));

    // Then no opening is overused
    expect(crowded(groups, MAX_PROMPTS_PER_OPENING)).toEqual([]);
  });
});

function opening(text: string, wordCount: number): string {
  return normalizeForComparison(text).split(' ').slice(0, wordCount).join(' ');
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

function crowded<T>(groups: Map<string, T[]>, max: number): string[] {
  return [...groups].filter(([, members]) => members.length > max).map(([key]) => key);
}
