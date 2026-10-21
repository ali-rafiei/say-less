import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalRevealSchedule } from '../src/shared.ts';
import { advanceToPhaseEnd, answerAll, makeRoom, startToWriting, type Harness } from './helpers.ts';

/**
 * Scripted 3-player game. Author-revealing answers let the single voter always
 * pick the alphabetically-first author, so every matchup is hand-computable:
 *  - A answers with 1 word, B and C fill the limit.
 *  - One voter per matchup; a win pays votes only.
 *  - Ring of 3 => pairs (A,B), (B,C), (C,A) each appear exactly once per round.
 *  R1 (x1):   A beats B: 100 | B beats C: 100 | A beats C: 100 => A 200, B 100, C 0
 *  R2 (x2):   same shape doubled               => A +400, B +200 => A 600, B 300, C 0
 *  Final (x3): A->[B,C], B->[A,C], C->[A,B]: A 2x600=1200, B 600+300=900, C 2x300=600
 *  Totals: A 1800, B 1200, C 600. Votes received: A 2+2+2=6, B 1+1+2=4, C 0+0+2=2.
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
    advanceToPhaseEnd(h);
  }
}

describe('a full 3-player game', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs LOBBY -> PODIUM with scores matching the hand computation', () => {
    const h = makeRoom(['a', 'b', 'c']);
    h.room.updateSettings('a', { roasts: true });
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
      a: 200,
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
      a: 600,
      b: 300,
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
    for (const player of h.room.players) {
      h.room.submitAnswer(player.id, finalPrompt.promptId, `${player.id} says hi`);
    }
    expect(h.room.phase).toBe('FINAL_VOTING');
    expect(h.state().final!.answers).toHaveLength(3);
    h.room.castFinalVotes('a', 'b', 'c');
    h.room.castFinalVotes('b', 'a', 'c');
    h.room.castFinalVotes('c', 'a', 'b');

    // The final is revealed answer by answer before the podium; totals wait for the podium.
    expect(h.room.phase).toBe('FINAL_REVEAL');
    expect(h.room.phaseEndsAt! - Date.now()).toBe(finalRevealSchedule(3).totalMs);
    expect(h.state().final!.result!.a!.points).toBe(1200);
    expect(h.state().final!.votes).not.toBeNull();
    expect(h.state().players.find((p) => p.id === 'a')!.score).toBe(600);
    advanceToPhaseEnd(h);

    expect(h.room.phase).toBe('PODIUM');
    const state = h.state();
    expect(Object.fromEntries(state.players.map((p) => [p.id, p.score]))).toEqual({
      a: 1800,
      b: 1200,
      c: 600,
    });
    expect(state.podium!.placements.map((p) => [p.playerId, p.place])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    expect(state.players.map((p) => p.stats.votesReceived)).toEqual([6, 4, 2]);
    expect(state.podium!.superlatives[0]).toEqual({
      title: 'Vote Magnet',
      playerId: 'a',
      detail: '6 votes received',
    });

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
    const dealtIds = new Set(
      h.room.players.flatMap((p) => h.room.yourPrompts(p.id).map((x) => x.promptId)),
    );
    expect(dealtIds.size).toBe(5);
    const appearances = new Map<string, number>();
    for (const player of h.room.players) {
      appearances.set(player.id, h.room.yourPrompts(player.id).length);
    }
    expect([...appearances.values()]).toEqual([2, 2, 2, 2, 2]);
  });
});
