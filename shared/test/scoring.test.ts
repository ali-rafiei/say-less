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
      multiplier: 2,
    });
    expect(result.delta).toEqual({ a: 400, b: 200 });
    expect(result.winnerIndex).toBe(0);
  });

  it('pays votes only, with no bonus, even for a clean sweep', () => {
    // Arrange: the final-round multiplier and every vote for one answer
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([3, 0]),
      roast: null,
      multiplier: 3,
    });
    // Assert
    expect(result.delta).toEqual({ a: 900, b: 0 });
    expect(result.awards.map((x) => x.kind)).toEqual(['votes']);
  });

  it('matches the spec worked example: roast backfire steals the roaster points', () => {
    // Arrange: roaster loses 2-3 to the player they roasted, ×2
    const result = scoreMatchup({
      answers: [answer({ playerId: 'roaster' }), answer({ playerId: 'target' })],
      votes: votesFor([2, 3]),
      roast: { spenderId: 'roaster', targetId: 'target' },
      multiplier: 2,
    });
    // Assert: target 600 for votes + the roaster's 400 stolen
    expect(result.delta.roaster).toBe(0);
    expect(result.delta.target).toBe(1000);
    expect(result.awards.find((a) => a.kind === 'steal')).toMatchObject({
      playerId: 'target',
      points: 400,
    });
  });

  it('records a backfire when the roasted target beats a roaster who had no points to steal', () => {
    // Arrange: four players, so two voters; both pick the roasted target
    const result = scoreMatchup({
      answers: [answer({ playerId: 'roaster' }), answer({ playerId: 'target' })],
      votes: votesFor([0, 2]),
      roast: { spenderId: 'roaster', targetId: 'target' },
      multiplier: 2,
    });
    // Assert: the tag is there, no points move, nobody is marked robbed
    expect(result.awards).toContainEqual({ playerId: 'target', kind: 'steal', points: 0 });
    expect(result.awards.some((a) => a.kind === 'stolen')).toBe(false);
    expect(result.delta).toEqual({ roaster: 0, target: 400 });
  });

  it('does not steal when the roaster is not in the matchup', () => {
    const result = scoreMatchup({
      answers: [answer({ playerId: 'x' }), answer({ playerId: 'target' })],
      votes: votesFor([1, 2]),
      roast: { spenderId: 'someone-else', targetId: 'target' },
      multiplier: 1,
    });
    expect(result.awards.some((a) => a.kind === 'steal')).toBe(false);
    expect(result.delta).toEqual({ x: 100, target: 200 });
  });

  it('splits a tie by vote share', () => {
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

  it('pays a flat GREAT MINDS bonus for identical answers and ignores votes', () => {
    const result = scoreMatchup({
      answers: [
        answer({ playerId: 'a', text: 'Tax fraud!' }),
        answer({ playerId: 'b', text: 'tax fraud' }),
      ],
      votes: votesFor([2, 0]),
      roast: null,
      multiplier: 2,
    });
    expect(result.greatMinds).toBe(true);
    expect(result.delta).toEqual({ a: 200, b: 200 });
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

describe('Bail Out and the crowd', () => {
  it('pays a random answer half its vote points', () => {
    // Arrange: the stock answer wins 3-1
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a', bailOut: true }), answer({ playerId: 'b' })],
      votes: votesFor([3, 1]),
      roast: null,
      multiplier: 1,
    });
    // Assert: 3 × 50; the loser keeps full vote points
    expect(result.delta).toEqual({ a: 150, b: 100 });
    expect(result.awards.map((a) => a.kind)).toEqual(['votes', 'votes']);
  });

  it('pays the Crowd Favourite bonus to the answer the audience preferred', () => {
    // Arrange: players split 1-1, the audience prefers b 2-1
    const result = scoreMatchup({
      answers: [answer({ playerId: 'a' }), answer({ playerId: 'b' })],
      votes: votesFor([1, 1]),
      audienceVotes: { x: 1, y: 1, z: 0 },
      roast: null,
      multiplier: 1.5,
    });
    // Assert: still a tie among players; the crowd bonus is 100 × 1.5
    expect(result.tie).toBe(true);
    expect(result.audienceCounts).toEqual([1, 2]);
    expect(result.delta).toEqual({ a: 150, b: 300 });
  });

  it('scores a final with a Bail Out and a crowd favourite', () => {
    // Arrange
    const votes: Record<string, [string, string]> = {
      a: ['b', 'c'],
      b: ['c', 'a'],
      c: ['a', 'b'],
    };
    // Act: b bailed out, the audience prefers a 2-1
    const tallies = scoreFinal(votes, ['a', 'b', 'c'], 1, {
      bailOutIds: new Set(['b']),
      audienceVotes: { x: 'a', y: 'a', z: 'c' },
    });
    // Assert: a 200 + 100 + crowd 100; b's 100 + 50 halved; c 200 + 100 and 1 crowd vote
    expect(tallies.a).toMatchObject({ first: 1, second: 1, crowd: 2, crowdFavourite: true });
    expect(tallies.a!.points).toBe(200 + 100 + 100);
    expect(tallies.b!.points).toBe(100 + 50);
    expect(tallies.c).toMatchObject({ first: 1, second: 1, points: 300, crowd: 1 });
  });

  it('gives no Crowd Favourite on an audience tie', () => {
    const tallies = scorePosts(
      {},
      [
        { id: 'p1', victimId: 'a', twisterId: 'b' },
        { id: 'p2', victimId: 'b', twisterId: 'a' },
      ],
      ['a', 'b'],
      1,
      { audienceVotes: { x: 'p1', y: 'p2' } },
    );
    expect(tallies.a!.crowdFavourite).toBe(false);
    expect(tallies.b!.crowdFavourite).toBe(false);
    expect(tallies.a!.crowd + tallies.b!.crowd).toBe(2);
  });
});
