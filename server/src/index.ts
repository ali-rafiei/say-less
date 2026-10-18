import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { PromptDeck, loadBailOuts, loadSeedBanks } from './prompts.ts';
import { RoomManager } from './roomManager.ts';
import { SessionSigner } from './session.ts';
import { PlayStats } from './stats.ts';
import { statsHandler } from './statsRoute.ts';
import { Gateway } from './ws.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, existsSync(join(here, '../../../content')) ? '../../..' : '../..');
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST;
const promptsPath = process.env.PROMPTS_PATH ?? join(repoRoot, 'content/prompts.json');
const clientDist = process.env.CLIENT_DIST ?? join(repoRoot, 'client/dist');
/** Unset keeps play counts in memory only (they reset with the process). */
const statsPath = process.env.STATS_PATH || null;
const statsKey = process.env.STATS_KEY || null;
const ONLINE_SAMPLE_MS = 30_000;

function log(message: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg: message, ...fields }));
}

const deck = PromptDeck.fromContent(promptsPath);
const seedBanks = loadSeedBanks(dirname(promptsPath));
const bailOuts = loadBailOuts(dirname(promptsPath));
const signer = new SessionSigner();
const stats = PlayStats.open({
  path: statsPath,
  timeZone: process.env.STATS_TZ ?? 'America/Edmonton',
  log,
});
let gateway: Gateway;
const rooms = new RoomManager({
  deck,
  seedBanks,
  bailOuts,
  onGameEvent: (event) => {
    if (event.type === 'started') stats.recordGameStarted(event.deviceIds, event.seats);
    else stats.recordGameFinished();
  },
  send: (playerId, message) => gateway.send(playerId, message),
  log,
});
gateway = new Gateway({ rooms, signer, log, onVisit: (deviceId) => stats.recordVisit(deviceId) });
const onlineSampler = setInterval(() => {
  const online = rooms.online();
  stats.observeOnline(online.players + online.audience);
}, ONLINE_SAMPLE_MS);
onlineSampler.unref();

const app = express();
app.disable('x-powered-by');
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, prompts: deck.size });
});
const online = () => rooms.online();
app.get('/stats', statsHandler({ stats, online, key: statsKey, format: 'html' }));
app.get('/stats.json', statsHandler({ stats, online, key: statsKey, format: 'json' }));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: 'index.html', maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
} else {
  log('client build not found; serving API only', { clientDist });
}

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 40_960 });
gateway.attach(wss);

httpServer.listen(port, host, () => {
  log('listening', {
    port,
    host,
    prompts: deck.size,
    clientDist: existsSync(clientDist),
    stats: statsPath ?? 'memory only',
    statsPage: statsKey ? 'on' : 'off (set STATS_KEY)',
  });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log('shutting down', { signal });
    clearInterval(onlineSampler);
    try {
      stats.close();
    } catch (error) {
      log('stats save failed on shutdown', { error: String(error) });
    }
    wss.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2_000).unref();
  });
}
