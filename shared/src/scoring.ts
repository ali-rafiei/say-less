import { POINTS } from './constants.ts';
import type { FinalTally, MatchupResult, PlayerAward, PublicPlayer, Roast } from './types.ts';
import { normalizeForComparison } from './words.ts';

export interface ScorableAnswer {
  playerId: string;
  text: string;
  wordCount: number;
  effectiveLimit: number;
  autoSubmitted: boolean;
}

export interface MatchupScoringInput {
  answers: [ScorableAnswer, ScorableAnswer];
  votes: Record<string, 0 | 1>;
  roast: Roast | null;
  multiplier: number;
}

export function roundTo5(value: number): number {
  return Math.round(value / 5) * 5;
}

export function scaled(base: number, multiplier: number): number {
  return roundTo5(base * multiplier);
}

function addAward(awards: PlayerAward[], delta: Record<string, number>, award: PlayerAward): void {
  if (award.points === 0) return;
  awards.push(award);
  delta[award.playerId] = (delta[award.playerId] ?? 0) + award.points;
}

export function scoreMatchup(input: MatchupScoringInput): MatchupResult {
  const { answers, votes, roast, multiplier } = input;
  const awards: PlayerAward[] = [];
  const delta: Record<string, number> = { [answers[0].playerId]: 0, [answers[1].playerId]: 0 };

  const greatMinds =
    !answers[0].autoSubmitted &&
    !answers[1].autoSubmitted &&
    normalizeForComparison(answers[0].text) === normalizeForComparison(answers[1].text);
  if (greatMinds) {
    for (const answer of answers) {
      addAward(awards, delta, {
        playerId: answer.playerId,
        kind: 'greatMinds',
        points: scaled(POINTS.GREAT_MINDS, multiplier),
      });
    }
    return { voteCounts: [0, 0], winnerIndex: null, tie: true, greatMinds, awards, delta };
  }

  const voteCounts: [number, number] = [0, 0];
  for (const choice of Object.values(votes)) voteCounts[choice] += 1;
  const totalVotes = voteCounts[0] + voteCounts[1];

  answers.forEach((answer, index) => {
    addAward(awards, delta, {
      playerId: answer.playerId,
      kind: 'votes',
      points: scaled(POINTS.VOTE * voteCounts[index]!, multiplier),
    });
  });

  const tie = voteCounts[0] === voteCounts[1];
  const winnerIndex: 0 | 1 | null = tie ? null : voteCounts[0] > voteCounts[1] ? 0 : 1;

  if (winnerIndex !== null) {
    const winner = answers[winnerIndex];
    const loser = answers[winnerIndex === 0 ? 1 : 0];
    if (voteCounts[winnerIndex] === totalVotes && totalVotes >= POINTS.SILENCED_MIN_VOTES) {
      addAward(awards, delta, {
        playerId: winner.playerId,
        kind: 'silenced',
        points: scaled(POINTS.SILENCED, multiplier),
      });
    }
    if (
      !winner.autoSubmitted &&
      winner.wordCount >= 1 &&
      winner.wordCount <= Math.floor(winner.effectiveLimit / 2)
    ) {
      addAward(awards, delta, {
        playerId: winner.playerId,
        kind: 'micDrop',
        points: scaled(POINTS.MIC_DROP, multiplier),
      });
    }
    if (roast && roast.targetId === winner.playerId && roast.spenderId === loser.playerId) {
      const stolen = delta[loser.playerId] ?? 0;
      addAward(awards, delta, { playerId: loser.playerId, kind: 'stolen', points: -stolen });
      // Recorded even at 0 points: the backfire itself is the payoff.
      awards.push({ playerId: winner.playerId, kind: 'steal', points: stolen });
      delta[winner.playerId] = (delta[winner.playerId] ?? 0) + stolen;
    }
  }

  return { voteCounts, winnerIndex, tie, greatMinds, awards, delta };
}

export function scoreFinal(
  votes: Record<string, [string, string]>,
  playerIds: string[],
  multiplier: number,
): Record<string, FinalTally> {
  const tallies: Record<string, FinalTally> = {};
  for (const id of playerIds) tallies[id] = { first: 0, second: 0, points: 0 };
  for (const [first, second] of Object.values(votes)) {
    const firstTally = tallies[first];
    if (firstTally) firstTally.first += 1;
    const secondTally = tallies[second];
    if (secondTally) secondTally.second += 1;
  }
  for (const tally of Object.values(tallies)) {
    tally.points =
      scaled(POINTS.FINAL_FIRST * tally.first, multiplier) +
      scaled(POINTS.FINAL_SECOND * tally.second, multiplier);
  }
  return tallies;
}

/** Standard competition ranking: equal scores share a place (1, 1, 3). */
export function computePlacements(
  players: readonly Pick<PublicPlayer, 'id' | 'score'>[],
): { playerId: string; place: number; score: number }[] {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const placements: { playerId: string; place: number; score: number }[] = [];
  sorted.forEach((player, index) => {
    const previous = placements[index - 1];
    const place = previous && previous.score === player.score ? previous.place : index + 1;
    placements.push({ playerId: player.id, place, score: player.score });
  });
  return placements;
}
