import { describe, expect, it } from 'vitest';
import {
  computePlacements,
  scoreFinal,
  scoreMatchup,
  scorePosts,
  type ScorableAnswer,
} from '../src/scoring.ts';

function answer(overrides: Partial<ScorableAnswer> & { playerId: string }): ScorableAnswer {
  return {
    text: `answer by ${overrides.playerId}`,
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
    // a: 200 for votes + 200 Mic Drop
    expect(result.delta).toEqual({ a: 400, b: 100 });
    expect(result.winnerIndex).toBe(0);
  });

  it('gives a Mic Drop for a 4-1 win in round 2 (80% of the votes)', () => {
    // Arrange: ×1.5, 5 voters
    const result = scoreMatchup({
      answers: [answer({ playerId: 'me' }), answer({ playerId: 'opp' })],
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
      answers: [answer({ playerId: 'roaster' }), answer({ playerId: 'target' })],
      votes: votesFor([2, 3]),
      roast: { spenderId: 'roaster', targetId: 'target' },
      multiplier: 1.5,
    });
    // Assert: target 450 votes + 300 Mic Drop (60% of the votes) + 300 stolen
    expect(result.delta.roaster).toBe(0);
    expect(result.delta.target).toBe(1050);
    expect(result.awards.find((a) => a.kind === 'steal')).toMatchObject({
      playerId: 'target',
      points: 300,
    });
  });

  it('records a backfire when the roasted target beats a roaster who had no points to steal', () => {
    // Arrange: four players, so two voters; both pick the roasted target
    const result = scoreMatchup({
      answers: [answer({ playerId: 'roaster' }), answer({ playerId: 'target' })],
      votes: votesFor([0, 2]),
      roast: { spenderId: 'roaster', targetId: 'target' },
      multiplier: 1.5,
    });
    // Assert: the stamp is there, no points move, nobody is marked robbed
    expect(result.awards).toContainEqual({ playerId: 'target', kind: 'steal', points: 0 });
    expect(result.awards.some((a) => a.kind === 'stolen')).toBe(false);
    // 300 votes + 375 Silenced
    expect(result.delta).toEqual({ roaster: 0, target: 675 });
  });

  it('does not steal when the roaster is not in the matchup', () => {
    const result = scoreMatchup({
      answers: [answer({ playerId: 'x' }), answer({ playerId: 'target' })],
      votes: votesFor([1, 2]),
      roast: { spenderId: 'someone-else', targetId: 'target' },
      multiplier: 1,
    });
    expect(result.awards.some((a) => a.kind === 'steal')).toBe(false);
    // target: 200 for votes + 200 Mic Drop
    expect(result.delta).toEqual({ x: 100, target: 400 });
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
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
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

  it('gives a Mic Drop for a 3-1 win', () => {
    // Given a 3-1 win
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([3, 1]),
      roast: null,
      multiplier: 1,
    });
    // Then the winner gets 300 for votes and 200 for the Mic Drop
    expect(result.awards.find((a) => a.kind === 'micDrop')).toMatchObject({
      playerId: 'a',
      points: 200,
    });
    expect(result.delta.a).toBe(500);
  });

  it('gives only Silenced for a sweep, never Mic Drop on top', () => {
    // Given a 3-0 sweep
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([3, 0]),
      roast: null,
      multiplier: 1,
    });
    // Then the winner gets 300 for votes and 250 for Silenced, nothing more
    expect(result.awards.some((a) => a.kind === 'micDrop')).toBe(false);
    expect(result.delta.a).toBe(550);
  });

  it('gives a Mic Drop for the narrowest win over half the votes', () => {
    // Given a 4-3 win (57%)
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([4, 3]),
      roast: null,
      multiplier: 1,
    });
    // Then it is a Mic Drop
    expect(result.awards.some((a) => a.kind === 'micDrop' && a.playerId === 'a')).toBe(true);
  });

  it('gives no Mic Drop at exactly half the votes', () => {
    // Given a 2-2 tie
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([2, 2]),
      roast: null,
      multiplier: 1,
    });
    // Then nobody gets a Mic Drop
    expect(result.awards.some((a) => a.kind === 'micDrop')).toBe(false);
  });

  it('gives no Mic Drop for a single vote', () => {
    // Given a three-player game, where each matchup has one voter
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([1, 0]),
      roast: null,
      multiplier: 1,
    });
    // Then winning that vote is not a Mic Drop
    expect(result.awards.some((a) => a.kind === 'micDrop')).toBe(false);
  });

  it('never gives a Mic Drop to an auto-submitted "…" that wins', () => {
    const result = scoreMatchup({
      answers: [
        answer({ playerId: 'a', text: '…', autoSubmitted: true }),
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
    expect(tallies.a).toMatchObject({ first: 2, second: 1, points: 1000 });
    expect(tallies.b).toMatchObject({ first: 1, second: 1, points: 600 });
    expect(tallies.c).toMatchObject({ first: 0, second: 1, points: 200 });
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

describe('scorePosts (Out of Context)', () => {
  const posts = [
    { id: 'p1', victimId: 'a', twisterId: 'b' },
    { id: 'p2', victimId: 'b', twisterId: 'c' },
    { id: 'p3', victimId: 'c', twisterId: 'a' },
  ];

  it('pays twisters per vote, victims pity points, and the Best Burn bonus', () => {
    // Given p1 gets 3 votes and p2 gets 1
    const votes: Record<string, [string, string]> = {
      a: ['p2', ''],
      c: ['p1', ''],
      d: ['p1', ''],
      e: ['p1', ''],
    };
    // When scored in a ×1 round
    const tallies = scorePosts(votes, posts, ['a', 'b', 'c', 'd', 'e'], 1);
    // Then B (twister of p1) gets 300 + 150 Best Burn, A (its victim) 60 + 30 pity
    expect(tallies.b).toMatchObject({ first: 3, points: 450, bestBurn: true, pity: 20 });
    expect(tallies.a).toMatchObject({ first: 0, points: 0, pity: 90 });
    expect(tallies.c).toMatchObject({ first: 1, points: 100, bestBurn: false, pity: 0 });
  });

  it('gives no Best Burn on a tie for the most votes', () => {
    // Given p1 and p2 tied on two votes each
    const votes: Record<string, [string, string]> = {
      a: ['p2', ''],
      c: ['p1', ''],
      d: ['p1', ''],
      e: ['p2', ''],
    };
    // Then nobody gets the bonus
    const tallies = scorePosts(votes, posts, ['a', 'b', 'c', 'd', 'e'], 1);
    expect(Object.values(tallies).some((t) => t.bestBurn)).toBe(false);
  });

  it('doubles everything in the final', () => {
    // Given one vote on p3 in a ×2 round
    const tallies = scorePosts({ b: ['p3', ''] }, posts, ['a', 'b', 'c'], 2);
    // Then A gets 200 and C 40 pity, and one vote is no Best Burn
    expect(tallies.a).toMatchObject({ points: 200, bestBurn: false });
    expect(tallies.c).toMatchObject({ pity: 40 });
  });
});
