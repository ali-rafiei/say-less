import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { OnlineNow, PlayStats, StatsSummary } from './stats.ts';

export interface StatsRouteDeps {
  stats: PlayStats;
  online: () => OnlineNow;
  /** from STATS_KEY; null turns the page off */
  key: string | null;
  format: 'html' | 'json';
}

/** The owner's stats page. Without the right `?key=` it looks like any unknown path. */
export function statsHandler(deps: StatsRouteDeps): RequestHandler {
  return (req, res) => {
    const given = typeof req.query.key === 'string' ? req.query.key : '';
    if (!deps.key || !sameSecret(given, deps.key)) {
      res.status(404).end();
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    const summary = deps.stats.summary(deps.online());
    if (deps.format === 'json') res.json(summary);
    else res.type('html').send(renderStatsPage(summary));
  };
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function renderStatsPage(s: StatsSummary): string {
  const maxPlayers = Math.max(1, ...s.days.map((d) => d.players));
  const rows = s.days
    .map(
      (d) => `<tr>
        <td>${d.date}</td>
        <td class="num"><span class="bar" style="width:${Math.round((d.players / maxPlayers) * 100)}%"></span>${d.players}</td>
        <td class="num">${d.visitors}</td>
        <td class="num">${d.gamesStarted}</td>
        <td class="num">${d.gamesFinished}</td>
        <td class="num">${d.peakOnline}</td>
      </tr>`,
    )
    .join('');
  const tile = (label: string, value: number, hint: string) =>
    `<div class="tile"><span class="label">${label}</span><span class="value">${value}</span><span class="hint">${hint}</span></div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Say Less stats</title>
<style>
  :root { --bg: #f6f4ef; --card: #fff; --ink: #1a1a2e; --dim: #6b6b7b; --line: #e3e0d8; --accent: #6c3bd1; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14141f; --card: #1e1e2d; --ink: #f1efe8; --dim: #a3a3b5; --line: #2e2e40; --accent: #a98bff; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--ink);
    font: 15px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; }
  main { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 10px; }
  .sub { color: var(--dim); margin: 0; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .tile { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px;
    display: flex; flex-direction: column; gap: 2px; }
  .label { color: var(--dim); font-size: 13px; }
  .value { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .hint { color: var(--dim); font-size: 12px; }
  .table-wrap { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { padding: 8px 12px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
  th { color: var(--dim); font-weight: 600; font-size: 13px; }
  tr:last-child td { border-bottom: 0; }
  .num { text-align: right; position: relative; }
  .bar { position: absolute; left: 0; top: 6px; bottom: 6px; background: var(--accent); opacity: 0.18; border-radius: 4px; }
  .empty { color: var(--dim); padding: 16px; margin: 0; }
</style>
</head>
<body>
<main>
  <h1>Say Less stats</h1>
  <p class="sub">Counting since ${s.since} (${s.timeZone}). Devices are anonymous; refresh for live numbers.</p>
  <h2>Online now</h2>
  <div class="tiles">
    ${tile('Players', s.online.players, 'connected, in a seat')}
    ${tile('Audience', s.online.audience, 'connected, watching')}
    ${tile('Rooms', s.online.rooms, 'open right now')}
  </div>
  <h2>All time</h2>
  <div class="tiles">
    ${tile('Players', s.totals.players, 'devices that played a game')}
    ${tile('Visitors', s.totals.visitors, 'devices that joined a room')}
    ${tile('Games started', s.totals.gamesStarted, `${s.totals.seats} player seat${s.totals.seats === 1 ? '' : 's'}`)}
    ${tile('Games finished', s.totals.gamesFinished, 'reached the podium')}
  </div>
  <h2>By day</h2>
  <div class="table-wrap">
    ${
      s.days.length === 0
        ? '<p class="empty">No games yet.</p>'
        : `<table>
      <thead><tr><th>Day</th><th class="num">Players</th><th class="num">Visitors</th><th class="num">Games</th><th class="num">Finished</th><th class="num">Peak online</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
    }
  </div>
</main>
</body>
</html>`;
}
