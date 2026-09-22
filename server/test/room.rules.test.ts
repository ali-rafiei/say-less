import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomError } from '../src/room.ts';
import type { PublicMatchup } from '../src/shared.ts';
import { answerAll, makeRoom, startToWriting, type Harness } from './helpers.ts';

/** Advance through VOTING/MATCHUP_REVEAL until the round results, calling back on each reveal. */
function drainRound(h: Harness, onReveal: (m: PublicMatchup) => void = () => {}): void {
  while (h.room.phase !== 'ROUND_RESULTS') {
    if (h.room.phase === 'VOTING') vi.advanceTimersByTime(20_000);
    else if (h.room.phase === 'MATCHUP_REVEAL') {
      onReveal(h.state().matchups[h.state().currentMatchupIndex]!);
      vi.advanceTimersByTime(6_000);
    } else throw new Error(`Unexpected phase ${h.room.phase}`);
  }
}

function toRoundTwoWindow(h: Harness): void {
  startToWriting(h);
  answerAll(h, (id, limit) => `${id} ${'x '.repeat(limit - 1)}`);
  drainRound(h);
  vi.advanceTimersByTime(8_000);
  vi.advanceTimersByTime(4_000);
  expect(h.room.phase).toBe('WRITING');
  expect(h.state().roundIndex).toBe(1);
}

describe('redaction', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides answer text while writing, authors while voting, and reveals both afterwards', () => {
    const h = makeRoom();
    startToWriting(h);
    h.room.submitAnswer('a', h.room.yourPrompts('a')[0]!.promptId, 'secret answer');
    const writing = h.state().matchups.flatMap((m) => m.answers);
    expect(writing.every((a) => a.text === null && a.playerId === null)).toBe(true);
    expect(JSON.stringify(h.state())).not.toContain('secret answer');

    answerAll(h, (id) => `${id} answer`);
    expect(h.room.phase).toBe('VOTING');
    const current = h.state().matchups[h.state().currentMatchupIndex]!;
    expect(current.answers.every((a) => typeof a.text === 'string' && a.playerId === null)).toBe(
      true,
    );
    expect(current.votes).toBeNull();
    const other = h.state().matchups.find((_, i) => i !== h.state().currentMatchupIndex)!;
    expect(other.answers.every((a) => a.text === null)).toBe(true);

    vi.advanceTimersByTime(20_000);
    expect(h.room.phase).toBe('MATCHUP_REVEAL');
    const revealed = h.state().matchups[h.state().currentMatchupIndex]!;
    expect(revealed.answers.every((a) => a.playerId !== null && a.text !== null)).toBe(true);
    expect(revealed.result).not.toBeNull();
  });

  it('never includes another player prompts in the public state', () => {
    const h = makeRoom();
    startToWriting(h);
    const state = JSON.stringify(h.state());
    expect(state).not.toContain('"promptText":"Prompt');
    expect(state).toContain('promptId');
  });
});

describe('answers and timers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rejects over-limit submissions with over_limit', () => {
    const h = makeRoom();
    startToWriting(h);
    const prompt = h.room.yourPrompts('a')[0]!;
    expect(() => h.room.submitAnswer('a', prompt.promptId, 'w '.repeat(13))).toThrowError(
      expect.objectContaining({ code: 'over_limit' }),
    );
  });

  it('auto-submits "…" for connected laggards and "[left the chat]" for disconnected ones', () => {
    const h = makeRoom();
    startToWriting(h);
    h.room.disconnect('c');
    vi.advanceTimersByTime(90_000);
    // A matchup whose only voter is the disconnected player reveals immediately.
    const texts = new Map<string, string[]>();
    drainRound(h, (m) => {
      for (const answer of m.answers) {
        texts.set(answer.playerId!, [...(texts.get(answer.playerId!) ?? []), answer.text!]);
      }
    });
    expect(texts.get('a')).toEqual(['…', '…']);
    expect(texts.get('c')).toEqual(['[left the chat]', '[left the chat]']);
  });

  it('pays GREAT MINDS to identical answers and skips voting bonuses', () => {
    const h = makeRoom();
    startToWriting(h);
    answerAll(h, () => 'Tax fraud');
    expect(h.room.phase).toBe('VOTING');
    vi.advanceTimersByTime(20_000);
    const m = h.state().matchups[0]!;
    expect(m.result!.greatMinds).toBe(true);
    expect(Object.values(m.result!.delta)).toEqual([100, 100]);
  });
});

describe('character select in the lobby', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves a race for the same character to exactly one owner', () => {
    const h = makeRoom();
    h.room.pickCharacter('a', 'lemon');
    expect(() => h.room.pickCharacter('b', 'lemon')).toThrowError(
      expect.objectContaining({ code: 'char_taken' }),
    );
    expect(h.state().players.filter((p) => p.characterId === 'lemon')).toHaveLength(1);
  });

  it('lets a player swap to a free character and frees the old one', () => {
    const h = makeRoom();
    h.room.pickCharacter('a', 'lemon');
    h.room.pickCharacter('a', 'ghost');
    h.room.pickCharacter('b', 'lemon');
    expect(h.state().players.map((p) => p.characterId)).toEqual(['ghost', 'lemon', null]);
  });

  it('assigns random unclaimed characters to anyone who did not pick when the game starts', () => {
    const h = makeRoom();
    h.room.pickCharacter('a', 'ghost');
    h.room.startGame('a');
    expect(h.room.phase).toBe('ROUND_INTRO');
    const ids = h.state().players.map((p) => p.characterId);
    expect(ids.every((id) => id !== null)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it('refuses picks once the game has started', () => {
    const h = makeRoom();
    h.room.startGame('a');
    expect(() => h.room.pickCharacter('b', 'toast')).toThrowError(
      expect.objectContaining({ code: 'bad_phase' }),
    );
  });
});

describe('roast tokens', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cannot be spent in round 1', () => {
    const h = makeRoom();
    startToWriting(h);
    expect(() => h.room.spendRoast('a', 'b')).toThrowError(
      expect.objectContaining({ code: 'bad_phase' }),
    );
  });

  it('limits the target to 2 words, refuses a second roast on the same target, and closes after 10s', () => {
    const h = makeRoom();
    toRoundTwoWindow(h);
    h.room.spendRoast('a', 'b');
    expect(h.last('b', 'roasted')!.payload.byName).toBe('A');
    expect(h.state().players.find((p) => p.id === 'a')!.roastTokens).toBe(0);
    expect(() => h.room.spendRoast('c', 'b')).toThrowError(
      expect.objectContaining({ code: 'already_roasted' }),
    );
    expect(() => h.room.spendRoast('c', 'c')).toThrowError(
      expect.objectContaining({ code: 'self_target' }),
    );
    vi.advanceTimersByTime(10_000);
    expect(() => h.room.spendRoast('c', 'a')).toThrowError(
      expect.objectContaining({ code: 'bad_phase' }),
    );
    const limits = h.room
      .yourPrompts('b')
      .map((p) => p.effectiveLimit)
      .sort();
    expect(limits).toEqual([2, 6]);
    const roasted = h.room.yourPrompts('b').find((p) => p.effectiveLimit === 2)!;
    expect(() => h.room.submitAnswer('b', roasted.promptId, 'one two three')).toThrowError(
      expect.objectContaining({ code: 'over_limit' }),
    );
    h.room.submitAnswer('b', roasted.promptId, 'one two');
  });

  it('backfires: the roasted winner steals the roaster points from that matchup', () => {
    // Matchups are generated before the roast window, so search seeds until the
    // roasted matchup (b's first) is a-vs-b. Deterministic given the PRNG.
    let h: Harness | null = null;
    let roastedIndex = -1;
    for (let seed = 1; seed < 200 && h === null; seed++) {
      const candidate = makeRoom(['a', 'b', 'c', 'd', 'e'], seed);
      toRoundTwoWindow(candidate);
      candidate.room.spendRoast('a', 'b');
      vi.advanceTimersByTime(10_000);
      const roasted = candidate.room.yourPrompts('b').find((p) => p.effectiveLimit === 2)!;
      const aFacesB = candidate.room
        .yourPrompts('a')
        .some((p) => p.matchupIndex === roasted.matchupIndex);
      if (aFacesB) {
        h = candidate;
        roastedIndex = roasted.matchupIndex!;
      }
    }
    if (!h) throw new Error('No seed produced an a-vs-b roasted matchup');

    answerAll(h, (id, limit) => `${id} ${'x '.repeat(limit - 1)}`.trim());
    // 3 voters: one for a, two for b. x1.5 => a 150, b 300; b steals a's 150.
    while (h.room.phase === 'VOTING') {
      const state = h.state();
      const m = state.matchups[state.currentMatchupIndex]!;
      const authors = m.answers.map((x) => x.text!.split(' ')[0]!);
      const voters = h.room.players.filter((p) => !authors.includes(p.id));
      if (state.currentMatchupIndex === roastedIndex) {
        const aIndex = authors.indexOf('a') as 0 | 1;
        const bIndex = authors.indexOf('b') as 0 | 1;
        h.room.castVote(voters[0]!.id, roastedIndex, aIndex);
        h.room.castVote(voters[1]!.id, roastedIndex, bIndex);
        h.room.castVote(voters[2]!.id, roastedIndex, bIndex);
        const revealed = h.state().matchups[roastedIndex]!;
        expect(revealed.roast).toEqual({ spenderId: 'a', targetId: 'b' });
        expect(revealed.result!.delta).toEqual({ a: 0, b: 450 });
        expect(revealed.result!.awards).toContainEqual({
          playerId: 'b',
          kind: 'steal',
          points: 150,
        });
        expect(revealed.result!.awards).toContainEqual({
          playerId: 'a',
          kind: 'stolen',
          points: -150,
        });
      } else {
        for (const v of voters) h.room.castVote(v.id, state.currentMatchupIndex, 0);
      }
      vi.advanceTimersByTime(6_000);
    }
    expect(h.room.phase).toBe('ROUND_RESULTS');
    expect(h.state().players.find((p) => p.id === 'b')!.stats.roasted).toBe(1);
  });
});

describe('presence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('passes leadership to the longest-connected player and announces it', () => {
    const h = makeRoom();
    h.room.disconnect('a');
    expect(h.room.leaderId).toBe('b');
    expect(h.state().banner).toBe('B is now the leader');
  });

  it('still reports my prompts during voting so a refreshed client knows its own matchups', () => {
    const h = makeRoom();
    startToWriting(h);
    answerAll(h, (id) => `${id} answer`);
    expect(h.room.phase).toBe('VOTING');
    h.room.disconnect('b');
    h.inbox.set('b', []);
    h.room.reconnect('b');
    const prompts = h.last('b', 'your_prompts')!.payload.prompts;
    expect(prompts).toHaveLength(2);
    expect(prompts.every((p) => p.submittedText === 'b answer')).toBe(true);
  });

  it('re-sends private prompts on reconnect during writing', () => {
    const h = makeRoom();
    startToWriting(h);
    h.room.disconnect('b');
    expect(h.state().players.find((p) => p.id === 'b')!.connected).toBe(false);
    h.inbox.set('b', []);
    h.room.reconnect('b');
    expect(h.last('b', 'your_prompts')!.payload.prompts).toHaveLength(2);
    expect(h.last('b', 'room_state')).toBeDefined();
  });

  it('removes a lobby player who does not return within the hold window', () => {
    const h = makeRoom();
    h.room.disconnect('c');
    vi.advanceTimersByTime(30_000);
    expect(h.room.players.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('suffixes duplicate names', () => {
    const h = makeRoom(['a']);
    h.room.addPlayer('b', 'A');
    h.room.addPlayer('c', 'a ');
    expect(h.room.players.map((p) => p.name)).toEqual(['A', 'A (2)', 'a (3)']);
  });

  it('refuses new joins mid-game and full rooms', () => {
    const h = makeRoom();
    startToWriting(h);
    expect(() => h.room.addPlayer('z', 'Zed')).toThrowError(
      expect.objectContaining({ code: 'bad_phase' }),
    );
    const full = makeRoom(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(() => full.room.addPlayer('9', 'Nine')).toThrowError(
      expect.objectContaining({ code: 'room_full' }),
    );
    expect(RoomError).toBeDefined();
  });
});

describe('custom prompts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lets any player add prompts in the lobby and only authors or the leader remove them', () => {
    const h = makeRoom();
    h.room.addPrompt('b', '  The worst   thing to hear from your barber  ');
    expect(h.state().customPrompts).toEqual([
      { id: 'c1', text: 'The worst thing to hear from your barber', authorId: 'b' },
    ]);
    expect(() => h.room.addPrompt('c', 'the worst thing to hear from your barber')).toThrowError(
      expect.objectContaining({ code: 'invalid' }),
    );
    expect(() => h.room.addPrompt('c', 'x'.repeat(121))).toThrowError(
      expect.objectContaining({ code: 'too_long' }),
    );
    expect(() => h.room.removePrompt('c', 'c1')).toThrowError(
      expect.objectContaining({ code: 'not_leader' }),
    );
    h.room.removePrompt('a', 'c1'); // leader
    expect(h.state().customPrompts).toEqual([]);
  });

  it('deals custom prompts first in custom mode, fills from the bank, and avoids the author', () => {
    const h = makeRoom(['a', 'b', 'c', 'd']);
    h.room.updateSettings('a', { promptMode: 'custom' });
    h.room.addPrompt('a', 'Prompt written by A');
    h.room.addPrompt('b', 'Prompt written by B');
    startToWriting(h);
    const dealt = h.state().matchups.map((m) => m.promptId);
    expect(dealt.filter((id) => id.startsWith('c'))).toHaveLength(2);
    expect(dealt.filter((id) => id.startsWith('p'))).toHaveLength(2);
    const aPrompts = h.room.yourPrompts('a').map((p) => p.text);
    const bPrompts = h.room.yourPrompts('b').map((p) => p.text);
    expect(aPrompts).not.toContain('Prompt written by A');
    expect(bPrompts).not.toContain('Prompt written by B');
  });

  it('ignores custom prompts in bank mode', () => {
    const h = makeRoom();
    h.room.addPrompt('a', 'Never dealt in bank mode');
    startToWriting(h);
    expect(h.state().matchups.every((m) => m.promptId.startsWith('p'))).toBe(true);
  });
});
