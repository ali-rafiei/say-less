import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptDeck } from '../src/prompts.ts';
import { Room } from '../src/room.ts';
import { encodeDrawing, type Prompt, type ServerMessage } from '../src/shared.ts';
import {
  advanceToPhaseEnd,
  makeRoom,
  seededRandom,
  startToWriting,
  type Harness,
} from './helpers.ts';

const SCRIBBLE = encodeDrawing({ strokes: [{ color: 0, width: 1, points: [10, 10, 60, 80] }] });

function toCreating(h: Harness, mode: 'doodle' | 'context'): void {
  h.room.updateSettings('a', { mode });
  h.room.startGame('a');
  vi.advanceTimersByTime(4_000);
  expect(h.room.phase).toBe('CREATING');
}

function createAll(h: Harness): void {
  for (const player of h.room.players) {
    const task = h.room.yourPrompts(player.id)[0]!;
    if (task.kind === 'draw') h.room.submitDrawing(player.id, task.promptId, SCRIBBLE);
    else h.room.submitAnswer(player.id, task.promptId, `${player.id} loves naps`);
  }
}

function drawingsFor(h: Harness, playerId: string): Record<string, string> {
  const items: Record<string, string> = {};
  for (const m of h.inbox.get(playerId) ?? []) {
    if (m.type === 'drawings') Object.assign(items, m.payload.items);
  }
  return items;
}

describe('Doodle mode', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('gives everyone a secret drawing task before any prompt is dealt', () => {
    // Given a Doodle game that just left the round intro
    const h = makeRoom();
    toCreating(h, 'doodle');
    // Then each player has one draw task and nobody has a caption prompt yet
    for (const player of h.room.players) {
      const tasks = h.room.yourPrompts(player.id);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.kind).toBe('draw');
    }
    expect(h.state().matchups).toHaveLength(0);
  });

  it('rejects a blank or garbled drawing', () => {
    // Given a player's draw task
    const h = makeRoom();
    toCreating(h, 'doodle');
    const task = h.room.yourPrompts('a')[0]!;
    // Then an empty or broken drawing is refused
    expect(() => h.room.submitDrawing('a', task.promptId, '')).toThrowError(
      expect.objectContaining({ code: 'empty' }),
    );
    expect(() => h.room.submitDrawing('a', task.promptId, '!!not-base64!!')).toThrowError(
      expect.objectContaining({ code: 'invalid' }),
    );
  });

  it('deals each drawing to two players who did not draw it, and sends them the strokes', () => {
    // Given every player has drawn
    const h = makeRoom();
    toCreating(h, 'doodle');
    createAll(h);
    // Then writing starts and every caption prompt is someone else's drawing
    expect(h.room.phase).toBe('WRITING');
    for (const player of h.room.players) {
      const prompts = h.room.yourPrompts(player.id);
      expect(prompts).toHaveLength(2);
      for (const prompt of prompts) {
        expect(prompt.seed?.kind).toBe('drawing');
        const drawingId = prompt.seed?.kind === 'drawing' ? prompt.seed.drawingId : '';
        expect(drawingsFor(h, player.id)[drawingId]).toBe(SCRIBBLE);
      }
    }
  });

  it('keeps the artist anonymous until the reveal', () => {
    // Given captions are in and voting has opened
    const h = makeRoom();
    toCreating(h, 'doodle');
    createAll(h);
    for (const player of h.room.players) {
      for (const p of h.room.yourPrompts(player.id)) {
        h.room.submitAnswer(player.id, p.promptId, `${player.id} caption`);
      }
    }
    expect(h.room.phase).toBe('VOTING');
    const voting = h.state().matchups[0]!.seed;
    // When the matchup is revealed
    advanceToPhaseEnd(h);
    const revealed = h.state().matchups[0]!.seed;
    // Then the artist shows only after the reveal
    expect(voting).toMatchObject({ kind: 'drawing', artistId: null });
    expect(revealed?.kind === 'drawing' && revealed.artistId).toBeTruthy();
  });

  it('fills the slot of a player who never drew with a bank prompt', () => {
    // Given only A draws before the timer runs out
    const h = makeRoom();
    toCreating(h, 'doodle');
    h.room.submitDrawing('a', h.room.yourPrompts('a')[0]!.promptId, SCRIBBLE);
    advanceToPhaseEnd(h);
    // Then one prompt is A's drawing and the other two come from the bank
    const prompts = h.room.players.flatMap((p) => h.room.yourPrompts(p.id));
    const seeded = new Set(prompts.filter((p) => p.seed).map((p) => p.promptId));
    const bank = new Set(prompts.filter((p) => !p.seed).map((p) => p.promptId));
    expect(seeded.size).toBe(1);
    expect(bank.size).toBe(2);
  });
});

describe('Out of Context mode', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function twistAll(h: Harness): void {
    for (const player of h.room.players) {
      for (const p of h.room.yourPrompts(player.id)) {
        h.room.submitAnswer(player.id, p.promptId, `${player.id} got banned`);
      }
    }
  }

  it("hands each player one other player's quote to twist, without the question", () => {
    // Given every player has answered their question honestly
    const h = makeRoom();
    toCreating(h, 'context');
    expect(h.room.yourPrompts('a')[0]!.kind).toBe('confess');
    createAll(h);
    // Then everyone twists exactly one quote, never their own, on a fake site
    expect(h.room.phase).toBe('FINAL_WRITING');
    const victims = h.room.players.map((player) => {
      const prompts = h.room.yourPrompts(player.id);
      expect(prompts).toHaveLength(1);
      const seed = prompts[0]!.seed;
      expect(seed).toMatchObject({ kind: 'post', twisterId: null });
      if (seed?.kind !== 'post') throw new Error('expected a post');
      expect(seed.victimId).not.toBe(player.id);
      expect(seed.quote).toMatch(/loves naps$/);
      expect(JSON.stringify(seed)).not.toMatch(/\?/);
      return seed.victimId;
    });
    expect(new Set(victims).size).toBe(h.room.players.length);
  });

  it('keeps the honest answer short', () => {
    // Given a player's question about themselves
    const h = makeRoom();
    toCreating(h, 'context');
    const task = h.room.yourPrompts('a')[0]!;
    // Then nine words are refused
    expect(() =>
      h.room.submitAnswer('a', task.promptId, 'one two three four five six seven eight nine'),
    ).toThrowError(expect.objectContaining({ code: 'over_limit' }));
  });

  it('puts every post on one wall, one vote each, never for your own twist', () => {
    // Given every quote has been twisted
    const h = makeRoom();
    toCreating(h, 'context');
    createAll(h);
    twistAll(h);
    // Then voting is single, on post ids, with the twisters hidden
    expect(h.room.phase).toBe('FINAL_VOTING');
    const final = h.state().final!;
    expect(final.voting).toBe('single');
    expect(final.answers.every((a) => a.playerId === null)).toBe(true);
    const myPost = h.room.yourPrompts('a');
    expect(myPost).toHaveLength(0);
    const own = final.answers.find((a) => a.text === 'a got banned')!.seed;
    const other = final.answers.find((a) => a.text === 'b got banned')!.seed;
    if (own?.kind !== 'post' || other?.kind !== 'post') throw new Error('expected posts');
    expect(() => h.room.castFinalVotes('a', own.postId, '')).toThrowError(
      expect.objectContaining({ code: 'invalid' }),
    );
    h.room.castFinalVotes('a', other.postId, '');
    expect(h.state().votedIds).toContain('a');
  });

  it('plays three wall rounds, scoring each after its reveal, then the podium', () => {
    // Given an Out of Context game where everyone creates, twists and votes each round
    const h = makeRoom();
    toCreating(h, 'context');
    for (let round = 0; round < 3; round++) {
      if (round > 0) {
        vi.advanceTimersByTime(4_000);
        expect(h.room.phase).toBe('CREATING');
      }
      createAll(h);
      twistAll(h);
      const wall = h.state().final!.answers;
      for (const player of h.room.players) {
        const target = wall.find((a) => a.text !== `${player.id} got banned`)?.seed;
        if (target?.kind === 'post') h.room.castFinalVotes(player.id, target.postId, '');
      }
      expect(h.room.phase).toBe('FINAL_REVEAL');
      advanceToPhaseEnd(h);
      if (round < 2) {
        expect(h.room.phase).toBe('ROUND_RESULTS');
        advanceToPhaseEnd(h);
      }
    }
    // Then the game ends on the podium with everyone's points in
    expect(h.room.phase).toBe('PODIUM');
    const total = h.state().players.reduce((sum, p) => sum + p.score, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe('prompts that name a player', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('names someone in the room who is not answering that prompt', () => {
    // Given a deck where every prompt names a player
    const named: Prompt[] = Array.from({ length: 20 }, (_, i) => ({
      id: `f${i}`,
      text: `Why {player} is late, take ${i}.`,
      rounds: [0, 1, 2],
    }));
    const inbox = new Map<string, ServerMessage[]>();
    const room = new Room('NAME', {
      deck: new PromptDeck(named, seededRandom(3)),
      send: (id, m) => inbox.set(id, [...(inbox.get(id) ?? []), m]),
      random: seededRandom(4),
    });
    for (const id of ['a', 'b', 'c', 'd']) room.addPlayer(id, id.toUpperCase());
    const h: Harness = {
      room,
      inbox,
      last: () => undefined as never,
      state: () => room.publicState(),
    };
    // When prompts are dealt
    startToWriting(h);
    // Then no prompt names one of its own two writers, and the token is gone
    for (const player of room.players) {
      for (const prompt of room.yourPrompts(player.id)) {
        expect(prompt.text).not.toContain('{player}');
        const name = /Why (\w) is late/.exec(prompt.text)![1]!;
        expect(name).not.toBe(player.name);
      }
    }
  });
});

describe('prompt packs', () => {
  it('draws only from the chosen packs', () => {
    // Given prompts from two packs
    const prompts: Prompt[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `a${i}`,
        text: `Food ${i}.`,
        rounds: [0] as const,
        pack: 'food',
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `b${i}`,
        text: `Work ${i}.`,
        rounds: [0] as const,
        pack: 'work',
      })),
    ].map((p) => ({ ...p, rounds: [...p.rounds] }));
    const deck = new PromptDeck(prompts, seededRandom(1));
    // When drawing from the food pack alone
    const drawn = deck.draw(0, 4, new Set(), ['food']);
    // Then every prompt is a food prompt
    expect(drawn.every((p) => p.pack === 'food')).toBe(true);
  });

  it('refuses an empty pack selection and ignores unknown packs', () => {
    // Given a lobby
    const h = makeRoom();
    // Then no packs is refused, and unknown ids are dropped
    expect(() => h.room.updateSettings('a', { packs: [] })).toThrowError(
      expect.objectContaining({ code: 'invalid' }),
    );
    h.room.updateSettings('a', { packs: ['food', 'nope'] });
    expect(h.state().settings.packs).toEqual(['food']);
  });
});
