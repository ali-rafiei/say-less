import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { PromptDeck } from './prompts.ts';
import { RoomManager } from './roomManager.ts';
import { SessionSigner } from './session.ts';
import { Gateway } from './ws.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, existsSync(join(here, '../../../content')) ? '../../..' : '../..');
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST;
const promptsPath = process.env.PROMPTS_PATH ?? join(repoRoot, 'content/prompts.json');
const clientDist = process.env.CLIENT_DIST ?? join(repoRoot, 'client/dist');

function log(message: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg: message, ...fields }));
}

const deck = PromptDeck.fromFile(promptsPath);
const signer = new SessionSigner();
let gateway: Gateway;
const rooms = new RoomManager({
  deck,
  send: (playerId, message) => gateway.send(playerId, message),
  log,
});
gateway = new Gateway({ rooms, signer, log });

const app = express();
app.disable('x-powered-by');
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, prompts: deck.size });
});
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: 'index.html', maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
} else {
  log('client build not found; serving API only', { clientDist });
}

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 8_192 });
gateway.attach(wss);

httpServer.listen(port, host, () => {
  log('listening', { port, host, prompts: deck.size, clientDist: existsSync(clientDist) });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log('shutting down', { signal });
    wss.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2_000).unref();
  });
}
