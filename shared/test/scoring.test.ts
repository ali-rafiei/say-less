import { describe, expect, it } from 'vitest';
import {
  computePlacements,
  scoreFinal,
  scoreMatchup,
  type ScorableAnswer,
} from '../src/scoring.ts';

function answer(overrides: Partial<ScorableAnswer> & { playerId: string }): ScorableAnswer {
  return {
    text: `answer by ${overrides.playerId}`,
    wordCount: 5,
    effectiveLimit: 6,
    autoSubmitted: false,
    ...overrides,
  };
}

function votesFor(counts: [number, number]): Record<string, 0 | 1> {
  const votes: Record<string, 0 | 1> = {};
  for (let i = 0; i < counts[0]; i++) votes[`v0-${i}`] = 0;
  for (let i = 0; i < counts[1]; i++) votes[`v1-${i}`] = 1;
  return votes;
}

describe('scoreMatchup', () => {
  it('pays 100 per vote scaled by the round multiplier', () => {
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([2, 1]),
      roast: null,
      multiplier: 1,
    });
    expect(result.delta).toEqual({ a: 200, b: 100 });
    expect(result.winnerIndex).toBe(0);
  });

  it('matches the spec worked example: round 2, 4-1 votes, 3-word answer earns a Mic Drop', () => {
    // Arrange: ×1.5, 5 voters, winner used 3 of 6 words
    const result = scoreMatchup({
      answers: [
        answer({ playerId: 'me', wordCount: 3, effectiveLimit: 6 }),
        answer({ playerId: 'opp', wordCount: 6, effectiveLimit: 6 }),
      ],
      votes: votesFor([4, 1]),
      roast: null,
      multiplier: 1.5,
    });
    // Assert: 600 votes + 300 mic drop, no Silenced
    expect(result.delta.me).toBe(900);
    expect(result.delta.opp).toBe(150);
    expect(result.awards.some((a) => a.kind === 'silenced')).toBe(false);
    expect(result.awards.find((a) => a.kind === 'micDrop')).toMatchObject({
      playerId: 'me',
      points: 300,
    });
  });

  it('matches the spec worked example: roast backfire steals the roaster points', () => {
    // Arrange: roaster loses 2-3 to the player they roasted, ×1.5
    const result = scoreMatchup({
      answers: [
        answer({ playerId: 'roaster', wordCount: 6, effectiveLimit: 6 }),
        answer({ playerId: 'target', wordCount: 2, effectiveLimit: 2 }),
      ],
      votes: votesFor([2, 3]),
      roast: { spenderId: 'roaster', targetId: 'target' },
      multiplier: 1.5,
    });
    // Assert: target 450 votes + 300 stolen (+ mic drop? 2 > floor(2/2)=1 so no)
    expect(result.delta.roaster).toBe(0);
    expect(result.delta.target).toBe(750);
    expect(result.awards.find((a) => a.kind === 'steal')).toMatchObject({
      playerId: 'target',
      points: 300,
    });
  });

  it('does not steal when the roaster is not in the matchup', () => {
    const result = scoreMatchup({
      answers: [
        answer({ playerId: 'x' }),
        answer({ playerId: 'target', effectiveLimit: 2, wordCount: 2 }),
      ],
      votes: votesFor([1, 2]),
      roast: { spenderId: 'someone-else', targetId: 'target' },
      multiplier: 1,
    });
    expect(result.awards.some((a) => a.kind === 'steal')).toBe(false);
    expect(result.delta).toEqual({ x: 100, target: 200 });
  });

  it('awards Silenced for a 100% sweep with at least 2 votes', () => {
    const swept = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([3, 0]),
      roast: null,
      multiplier: 2,
    });
    expect(swept.awards.find((a) => a.kind === 'silenced')).toMatchObject({
      playerId: 'a',
      points: 500,
    });

    const single = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([1, 0]),
      roast: null,
      multiplier: 1,
    });
    expect(single.awards.some((a) => a.kind === 'silenced')).toBe(false);
  });

  it('splits a tie by vote share with no winner bonuses', () => {
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a', wordCount: 1 }), answer({ playerId: 'b', wordCount: 1 })],
      votes: votesFor([2, 2]),
      roast: null,
      multiplier: 1,
    });
    expect(result.tie).toBe(true);
    expect(result.winnerIndex).toBeNull();
    expect(result.delta).toEqual({ a: 200, b: 200 });
    expect(result.awards.every((a) => a.kind === 'votes')).toBe(true);
  });

  it('gives both 0 when all voters abstain', () => {
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: {},
      roast: null,
      multiplier: 1,
    });
    expect(result.delta).toEqual({ a: 0, b: 0 });
    expect(result.awards).toEqual([]);
  });

  it('never gives a Mic Drop to an auto-submitted "…" that wins', () => {
    const result = scoreMatchup({
      answers: [
        answer({ playerId: 'a', text: '…', wordCount: 0, autoSubmitted: true }),
        answer({ playerId: 'b' }),
      ],
      votes: votesFor([2, 0]),
      roast: null,
      multiplier: 1,
    });
    expect(result.awards.some((a) => a.kind === 'micDrop')).toBe(false);
    expect(result.delta.a).toBe(450);
  });

  it('pays a flat GREAT MINDS bonus for identical answers and ignores votes', () => {
    const result = scoreMatchup({
      answers: [
        answer({ playerId: 'a', text: 'Tax fraud!' }),
        answer({ playerId: 'b', text: 'tax fraud' }),
      ],
      votes: votesFor([2, 0]),
      roast: null,
      multiplier: 1.5,
    });
    expect(result.greatMinds).toBe(true);
    expect(result.delta).toEqual({ a: 150, b: 150 });
  });
});

describe('scoreFinal', () => {
  it('pays 200 per first-choice and 100 per second-choice vote, ×2', () => {
    const tallies = scoreFinal(
      { v1: ['a', 'b'], v2: ['a', 'c'], v3: ['b', 'a'] },
      ['a', 'b', 'c'],
      2,
    );
    expect(tallies.a).toEqual({ first: 2, second: 1, points: 1000 });
    expect(tallies.b).toEqual({ first: 1, second: 1, points: 600 });
    expect(tallies.c).toEqual({ first: 0, second: 1, points: 200 });
  });
});

describe('computePlacements', () => {
  it('shares a place on a tie and skips the next place', () => {
    const placements = computePlacements([
      { id: 'a', score: 900 },
      { id: 'b', score: 900 },
      { id: 'c', score: 500 },
    ]);
    expect(placements.map((p) => [p.playerId, p.place])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ]);
  });
});
