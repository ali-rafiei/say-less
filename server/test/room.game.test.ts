import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answerAll, makeRoom, startToWriting, type Harness } from './helpers.ts';

/**
 * Scripted 3-player game. Author-revealing answers let the single voter always
 * pick the alphabetically-first author, so every matchup is hand-computable:
 *  - A answers with 1 word (Mic Drop whenever A wins), B and C fill the limit.
 *  - Ring of 3 => pairs (A,B), (B,C), (C,A) each appear exactly once per round.
 *  R1 (x1):   A beats B: 100 + 200 = 300 | B beats C: 100 | A beats C: 300 => A 600, B 100, C 0
 *  R2 (x1.5): same shape scaled          => A +900, B +150      => A 1500, B 250, C 0
 *  Final (x2): A->[B,C], B->[A,C], C->[A,B]: A 2x400=800, B 400+200=600, C 2x200=400
 *  Totals: A 2300, B 850, C 400
 */
function answerText(playerId: string, limit: number): string {
  if (playerId === 'a') return 'a';
  return [playerId, ...Array.from({ length: limit - 1 }, (_, i) => `w${i}`)].join(' ');
}

function voteForFirstAuthor(h: Harness): void {
  const state = h.state();
  const matchup = state.matchups[state.currentMatchupIndex]!;
  const authors = matchup.answers.map((a) => a.text!.split(' ')[0]!);
  const voter = h.room.players.find((p) => !authors.includes(p.id))!;
  const winner = authors.indexOf([...authors].sort()[0]!) as 0 | 1;
  h.room.castVote(voter.id, state.currentMatchupIndex, winner);
}

function playMatchupRound(h: Harness): void {
  const count = h.state().matchups.length;
  for (let i = 0; i < count; i++) {
    expect(h.room.phase).toBe('VOTING');
    voteForFirstAuthor(h);
    expect(h.room.phase).toBe('MATCHUP_REVEAL');
    vi.advanceTimersByTime(6_000);
  }
}

describe('a full 3-player game', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs LOBBY -> PODIUM with scores matching the hand computation', () => {
    const h = makeRoom(['a', 'b', 'c']);
    h.room.updateSettings('a', { emojiFinal: 'off' });
    startToWriting(h);

    // Round 1
    expect(h.room.phase).toBe('WRITING');
    expect(h.state().roundIndex).toBe(0);
    expect(h.state().matchups).toHaveLength(3);
    for (const player of h.room.players) {
      expect(h.last(player.id, 'your_prompts')!.payload.prompts).toHaveLength(2);
    }
    answerAll(h, answerText);
    playMatchupRound(h);
    expect(h.room.phase).toBe('ROUND_RESULTS');
    expect(Object.fromEntries(h.state().players.map((p) => [p.id, p.score]))).toEqual({
      a: 600,
      b: 100,
      c: 0,
    });
    vi.advanceTimersByTime(8_000);

    // Round 2 (roast window first, nobody roasts)
    expect(h.room.phase).toBe('ROUND_INTRO');
    vi.advanceTimersByTime(4_000);
    expect(h.room.phase).toBe('WRITING');
    expect(h.state().roastWindowEndsAt).not.toBeNull();
    expect(h.room.yourPrompts('a')).toHaveLength(0);
    vi.advanceTimersByTime(10_000);
    expect(h.state().roastWindowEndsAt).toBeNull();
    expect(h.room.yourPrompts('a')).toHaveLength(2);
    answerAll(h, answerText);
    playMatchupRound(h);
    expect(Object.fromEntries(h.state().players.map((p) => [p.id, p.score]))).toEqual({
      a: 1500,
      b: 250,
      c: 0,
    });
    vi.advanceTimersByTime(8_000);

    // Final round
    expect(h.room.phase).toBe('ROUND_INTRO');
    expect(h.state().roundIndex).toBe(2);
    vi.advanceTimersByTime(4_000);
    expect(h.room.phase).toBe('FINAL_WRITING');
    const finalPrompt = h.room.yourPrompts('a')[0]!;
    expect(finalPrompt.effectiveLimit).toBe(3);
    expect(finalPrompt.mode).toBe('words');
    for (const player of h.room.players) {
      h.room.submitAnswer(player.id, finalPrompt.promptId, `${player.id} says hi`);
    }
    expect(h.room.phase).toBe('FINAL_VOTING');
    expect(h.state().final!.answers).toHaveLength(3);
    h.room.castFinalVotes('a', 'b', 'c');
    h.room.castFinalVotes('b', 'a', 'c');
    h.room.castFinalVotes('c', 'a', 'b');

    expect(h.room.phase).toBe('PODIUM');
    const state = h.state();
    expect(Object.fromEntries(state.players.map((p) => [p.id, p.score]))).toEqual({
      a: 2300,
      b: 850,
      c: 400,
    });
    expect(state.podium!.placements.map((p) => [p.playerId, p.place])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    expect(state.players.find((p) => p.id === 'a')!.stats.micDrops).toBe(4);
    expect(state.podium!.superlatives.map((s) => s.title)).toContain('Most Mic Drops');

    // Rematch returns to the lobby with scores reset on next start
    h.room.rematch('a');
    expect(h.room.phase).toBe('LOBBY');
    expect(h.state().gamesPlayed).toBe(1);
  });

  it('uses every prompt once per game and each player appears in exactly 2 matchups', () => {
    const h = makeRoom(['a', 'b', 'c', 'd', 'e']);
    startToWriting(h);
    const matchups = h.state().matchups;
    expect(matchups).toHaveLength(5);
    expect(new Set(matchups.map((m) => m.promptId)).size).toBe(5);
    const appearances = new Map<string, number>();
    for (const player of h.room.players) {
      appearances.set(player.id, h.room.yourPrompts(player.id).length);
    }
    expect([...appearances.values()]).toEqual([2, 2, 2, 2, 2]);
  });
});
