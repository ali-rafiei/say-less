import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizeForComparison } from '../src/shared.ts';

interface PackPrompt {
  id: string;
  text: string;
  rounds: number[];
}
interface PackFile {
  id: string;
  name: string;
  prompts: PackPrompt[];
}

const CONTENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../content');
const PACKS_DIR = resolve(CONTENT_DIR, 'packs');

const EXPECTED_PACKS: Record<string, string> = {
  friends: 'Group Chat',
  food: 'Food Fight',
  work: '9 to 5',
  online: 'Extremely Online',
  movies: 'Movie Night',
  family: 'Family Friendly',
  afterdark: 'After Dark',
};
const MIN_PROMPTS_PER_PACK = 50;
const MIN_FINAL_ROUND_PROMPTS_PER_PACK = 20;
const FRIENDS_PROMPTS = 60;
const MAX_PLAYER_TOKEN_PROMPTS_OUTSIDE_FRIENDS = 10;
const MIN_TEXT_CHARS = 8;
const MAX_TEXT_CHARS = 120;
const KNOWN_ROUNDS = [0, 1, 2];
const PLAYER_TOKEN = '{player}';
const PACK_PROMPT_ID = /^[a-z]+-\d{3}$/;
const CLASSIC_PROMPT_ID = /^p\d{3}$/;

const MIN_DOODLES = 90;
const MAX_DOODLE_CHARS = 49;
const DOODLE_ID = /^d\d{3}$/;
const TRAILING_PUNCTUATION = /[.,;:!?…"'\s]$/;
const MIN_BURNS = 90;
const MAX_BURN_CHARS = 69;
const BURN_ID = /^b\d{3}$/;

const BLANK = '___';
const ENDS_WITH_PUNCTUATION_OR_BLANK = /(?:[.?!:]"?|___)$/;
const UNDERSCORE_RUN = /_+/g;
const ELLIPSIS = /\.\.\.|…/;
const SMART_QUOTES = /[‘’‚‛“”„‟]/;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
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

const packFiles = readdirSync(PACKS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => ({ filename: name, pack: readJson<PackFile>(resolve(PACKS_DIR, name)) }));
const packPrompts = packFiles.flatMap(({ pack }) => pack.prompts);
const classicPrompts = readJson<{ prompts: PackPrompt[] }>(
  resolve(CONTENT_DIR, 'prompts.json'),
).prompts;
const everyPrompt = [...classicPrompts, ...packPrompts];
const doodles = readJson<{ prompts: { id: string; text: string }[] }>(
  resolve(CONTENT_DIR, 'doodles.json'),
).prompts;
const burns = readJson<{ questions: { id: string; text: string }[] }>(
  resolve(CONTENT_DIR, 'questions.json'),
).questions;

describe('pack files', () => {
  it('ships exactly the seven catalog packs, named as the catalog names them', () => {
    // Given the packs found on disk
    const found = Object.fromEntries(packFiles.map(({ pack }) => [pack.id, pack.name]));

    // Then they are exactly the catalog
    expect(found).toEqual(EXPECTED_PACKS);
  });

  it('matches each file id to its filename', () => {
    // Given packs whose id differs from their file name
    const mismatched = packFiles.filter(({ filename, pack }) => filename !== `${pack.id}.json`);

    // Then there are none
    expect(mismatched.map(({ filename }) => filename)).toEqual([]);
  });

  it(`holds at least ${MIN_PROMPTS_PER_PACK} prompts in every pack`, () => {
    // Given packs below the minimum
    const small = packFiles.filter(({ pack }) => pack.prompts.length < MIN_PROMPTS_PER_PACK);

    // Then there are none
    expect(small.map(({ pack }) => pack.id)).toEqual([]);
  });

  it(`tags at least ${MIN_FINAL_ROUND_PROMPTS_PER_PACK} prompts for the final round in every pack`, () => {
    // Given packs with too few final-round prompts
    const short = packFiles.filter(
      ({ pack }) =>
        pack.prompts.filter((p) => p.rounds.includes(2)).length < MIN_FINAL_ROUND_PROMPTS_PER_PACK,
    );

    // Then there are none
    expect(short.map(({ pack }) => pack.id)).toEqual([]);
  });
});

describe('pack prompt ids and rounds', () => {
  it('gives every prompt an id of the form <packid>-NNN that starts with its own pack id', () => {
    // Given prompts whose id is malformed or belongs to another pack
    const wrong = packFiles.flatMap(({ pack }) =>
      pack.prompts.filter((p) => !PACK_PROMPT_ID.test(p.id) || !p.id.startsWith(`${pack.id}-`)),
    );

    // Then there are none
    expect(wrong.map((p) => p.id)).toEqual([]);
  });

  it('keeps ids unique across every pack and prompts.json', () => {
    // Given every prompt id, classic bank included
    const ids = everyPrompt.map((p) => p.id);

    // Then none repeats
    expect(duplicates(ids)).toEqual([]);
  });

  it('keeps classic prompt ids out of the pack namespace', () => {
    // Given the classic bank ids
    const collisions = classicPrompts.filter((p) => !CLASSIC_PROMPT_ID.test(p.id));

    // Then they all keep the pNNN format packs never use
    expect(collisions.map((p) => p.id)).toEqual([]);
  });

  it('tags every prompt with a non-empty, strictly sorted set of known rounds', () => {
    // Given prompts whose rounds are empty, unknown, unsorted or repeated
    const badlyTagged = packPrompts.filter(
      (p) =>
        p.rounds.length === 0 ||
        p.rounds.some((r, i) => !KNOWN_ROUNDS.includes(r) || (i > 0 && r <= p.rounds[i - 1]!)),
    );

    // Then there are none
    expect(badlyTagged.map((p) => p.id)).toEqual([]);
  });
});

describe('pack prompt text', () => {
  it(`keeps every text between ${MIN_TEXT_CHARS} and ${MAX_TEXT_CHARS} characters`, () => {
    // Given prompts outside the length bounds
    const outOfBounds = packPrompts.filter(
      (p) => p.text.length < MIN_TEXT_CHARS || p.text.length > MAX_TEXT_CHARS,
    );

    // Then there are none
    expect(outOfBounds.map((p) => p.text)).toEqual([]);
  });

  it(`ends every text with punctuation or a ${BLANK} blank`, () => {
    // Given prompts with a dangling ending
    const dangling = packPrompts.filter((p) => !ENDS_WITH_PUNCTUATION_OR_BLANK.test(p.text));

    // Then there are none
    expect(dangling.map((p) => p.text)).toEqual([]);
  });

  it(`writes every blank as exactly ${BLANK} and never as an ellipsis`, () => {
    // Given prompts with a differently written blank
    const offConvention = packPrompts.filter(
      (p) =>
        ELLIPSIS.test(p.text) || (p.text.match(UNDERSCORE_RUN) ?? []).some((run) => run !== BLANK),
    );

    // Then there are none
    expect(offConvention.map((p) => p.text)).toEqual([]);
  });

  it('has no leading, trailing or doubled whitespace', () => {
    // Given prompts with untidy whitespace
    const untidy = packPrompts.filter(
      (p) => p.text !== p.text.trim() || /\s{2}|[^\S ]/.test(p.text),
    );

    // Then there are none
    expect(untidy.map((p) => p.text)).toEqual([]);
  });

  it('uses plain ASCII quotes and apostrophes, never smart ones', () => {
    // Given prompts with typographic quotes
    const smart = packPrompts.filter((p) => SMART_QUOTES.test(p.text));

    // Then there are none
    expect(smart.map((p) => p.text)).toEqual([]);
  });

  it('contains no emoji', () => {
    // Given prompts with emoji in the text
    const withEmoji = packPrompts.filter((p) => EMOJI.test(p.text));

    // Then there are none
    expect(withEmoji.map((p) => p.text)).toEqual([]);
  });

  it('mentions no real brand or public figure from the banned list', () => {
    // Given prompts naming a banned word, plural or possessive included
    const banned = packPrompts.filter((p) => mentionsBannedWord(p.text));

    // Then there are none
    expect(banned.map((p) => p.text)).toEqual([]);
  });

  it('has no two prompts with the same normalized text across packs and prompts.json', () => {
    // Given every prompt text grouped by its normalized form
    const normalized = everyPrompt.map((p) => normalizeForComparison(p.text));

    // Then no text appears twice
    expect(duplicates(normalized)).toEqual([]);
  });
});

describe('player token', () => {
  it(`gives every friends prompt exactly one ${PLAYER_TOKEN}`, () => {
    // Given the friends pack
    const friends = packFiles.find(({ pack }) => pack.id === 'friends')!.pack;

    // When counting the prompts without exactly one token
    const wrong = friends.prompts.filter((p) => countPlayerTokens(p.text) !== 1);

    // Then there are none, and the pack is full-sized
    expect(wrong.map((p) => p.text)).toEqual([]);
    expect(friends.prompts.length).toBe(FRIENDS_PROMPTS);
  });

  it(`lets no prompt anywhere hold more than one ${PLAYER_TOKEN}`, () => {
    // Given every prompt, classic bank included
    const crowded = everyPrompt.filter((p) => countPlayerTokens(p.text) > 1);

    // Then there are none
    expect(crowded.map((p) => p.text)).toEqual([]);
  });

  it(`lets at most ${MAX_PLAYER_TOKEN_PROMPTS_OUTSIDE_FRIENDS} prompts per non-friends pack use ${PLAYER_TOKEN}`, () => {
    // Given the non-friends packs using the token more than allowed
    const overusers = packFiles.filter(
      ({ pack }) =>
        pack.id !== 'friends' &&
        pack.prompts.filter((p) => countPlayerTokens(p.text) > 0).length >
          MAX_PLAYER_TOKEN_PROMPTS_OUTSIDE_FRIENDS,
    );

    // Then there are none
    expect(overusers.map(({ pack }) => pack.id)).toEqual([]);
  });

  it('writes no stray braces beyond the player token', () => {
    // Given prompts with braces once the token is removed
    const stray = packPrompts.filter((p) => /[{}]/.test(p.text.split(PLAYER_TOKEN).join('')));

    // Then there are none
    expect(stray.map((p) => p.text)).toEqual([]);
  });
});

describe('doodle prompts', () => {
  it(`holds at least ${MIN_DOODLES} suggestions`, () => {
    // Given the shipped doodle list
    // Then it is large enough to avoid repeats
    expect(doodles.length).toBeGreaterThanOrEqual(MIN_DOODLES);
  });

  it('gives every doodle a unique dNNN id', () => {
    // Given every doodle id
    const ids = doodles.map((d) => d.id);

    // Then each matches the format and none repeats
    expect(ids.filter((id) => !DOODLE_ID.test(id))).toEqual([]);
    expect(duplicates(ids)).toEqual([]);
  });

  it(`keeps every doodle under ${MAX_DOODLE_CHARS + 1} characters with no trailing punctuation`, () => {
    // Given doodles too long or ending in punctuation
    const bad = doodles.filter(
      (d) =>
        d.text.length > MAX_DOODLE_CHARS ||
        d.text.length === 0 ||
        TRAILING_PUNCTUATION.test(d.text),
    );

    // Then there are none
    expect(bad.map((d) => d.text)).toEqual([]);
  });

  it('has no duplicate doodle text and no banned words, emoji or smart quotes', () => {
    // Given doodle texts
    const texts = doodles.map((d) => d.text);
    const offending = texts.filter(
      (t) => mentionsBannedWord(t) || EMOJI.test(t) || SMART_QUOTES.test(t) || ELLIPSIS.test(t),
    );

    // Then none is a repeat or breaks the content rules
    expect(duplicates(texts.map(normalizeForComparison))).toEqual([]);
    expect(offending).toEqual([]);
  });
});

describe('Out of Context questions', () => {
  it(`holds at least ${MIN_BURNS} questions`, () => {
    // Given the shipped Out of Context questions
    // Then there are enough for a full game without repeats
    expect(burns.length).toBeGreaterThanOrEqual(MIN_BURNS);
  });

  it('gives every question a unique bNNN id', () => {
    // Given every question id
    const ids = burns.map((b) => b.id);

    // Then each matches the format and none repeats
    expect(ids.filter((id) => !BURN_ID.test(id))).toEqual([]);
    expect(duplicates(ids)).toEqual([]);
  });

  it(`keeps every question under ${MAX_BURN_CHARS + 1} characters and ending in a question mark`, () => {
    // Given questions too long or not ending in "?"
    const bad = burns.filter((b) => b.text.length > MAX_BURN_CHARS || !b.text.endsWith('?'));

    // Then there are none
    expect(bad.map((b) => b.text)).toEqual([]);
  });

  it('has no duplicate question text and no banned words, emoji or smart quotes', () => {
    // Given question texts
    const texts = burns.map((b) => b.text);
    const offending = texts.filter(
      (t) => mentionsBannedWord(t) || EMOJI.test(t) || SMART_QUOTES.test(t) || ELLIPSIS.test(t),
    );

    // Then none is a repeat or breaks the content rules
    expect(duplicates(texts.map(normalizeForComparison))).toEqual([]);
    expect(offending).toEqual([]);
  });
});

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function mentionsBannedWord(text: string): boolean {
  return BANNED_WORDS.some((word) => new RegExp(`\\b${word}(?:'s|s)?\\b`, 'i').test(text));
}

function countPlayerTokens(text: string): number {
  return text.split(PLAYER_TOKEN).length - 1;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}
