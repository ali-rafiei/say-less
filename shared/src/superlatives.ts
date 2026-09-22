import type { PublicPlayer, Superlative } from './types.ts';

function top<T>(items: readonly T[], metric: (item: T) => number): T | null {
  let best: T | null = null;
  let bestValue = 0;
  for (const item of items) {
    const value = metric(item);
    if (value > bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best;
}

export function computeSuperlatives(players: readonly PublicPlayer[]): Superlative[] {
  const list: Superlative[] = [];

  const micDropper = top(players, (p) => p.stats.micDrops);
  if (micDropper) {
    list.push({
      title: 'Most Mic Drops',
      playerId: micDropper.id,
      detail: `${micDropper.stats.micDrops} mic drop${micDropper.stats.micDrops === 1 ? '' : 's'}`,
    });
  }

  const topScore = Math.max(...players.map((p) => p.score));
  const losers = players.filter((p) => p.score < topScore);
  const wordiest = top(losers, (p) => p.stats.wordsUsedTotal / Math.max(p.score, 1));
  if (wordiest && wordiest.stats.wordsUsedTotal > 0) {
    const ratio = wordiest.stats.wordsUsedTotal / Math.max(wordiest.score, 1);
    list.push({
      title: 'Wordiest Loser',
      playerId: wordiest.id,
      detail: `${wordiest.stats.wordsUsedTotal} words for ${wordiest.score} points (${ratio.toFixed(2)} w/pt)`,
    });
  }

  const victim = top(players, (p) => p.stats.roasted);
  if (victim) {
    list.push({ title: 'Roast Victim', playerId: victim.id, detail: 'Got roasted and lived' });
  }

  const silencer = top(players, (p) => p.stats.silenced);
  if (silencer) {
    list.push({
      title: 'The Silencer',
      playerId: silencer.id,
      detail: `Swept ${silencer.stats.silenced} matchup${silencer.stats.silenced === 1 ? '' : 's'}`,
    });
  }

  const withSubmissions = players.filter((p) => p.stats.submissions > 0);
  const fastest = top(
    withSubmissions,
    (p) => 1 / Math.max(p.stats.submitMsTotal / p.stats.submissions, 1),
  );
  if (fastest) {
    const avgSeconds = fastest.stats.submitMsTotal / fastest.stats.submissions / 1000;
    list.push({
      title: 'Fastest Submitter',
      playerId: fastest.id,
      detail: `${avgSeconds.toFixed(1)}s per answer on average`,
    });
  }

  return list;
}
