import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import { PromptDeck } from '../src/prompts.ts';
import { RoomManager } from '../src/roomManager.ts';
import { SessionSigner } from '../src/session.ts';
import { Gateway } from '../src/ws.ts';
import { LIMITS, MAX_ROOMS, type ClientMessage, type ServerMessage } from '../src/shared.ts';
import { fixturePrompts } from './helpers.ts';

/** Real sockets against the real gateway on an ephemeral port. */
class Client {
  private inbox: ServerMessage[] = [];
  private waiters: ((m: ServerMessage) => void)[] = [];
  constructor(readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      const waiter = this.waiters.shift();
      if (waiter) waiter(message);
      else this.inbox.push(message);
    });
  }
  static async connect(port: number): Promise<Client> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await once(ws, 'open');
    return new Client(ws);
  }
  send(message: ClientMessage): void {
    this.ws.send(JSON.stringify(message));
  }
  next(): Promise<ServerMessage> {
    const queued = this.inbox.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve) => this.waiters.push(resolve));
  }
  async until<T extends ServerMessage['type']>(
    type: T,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    for (;;) {
      const message = await this.next();
      if (message.type === type) return message as Extract<ServerMessage, { type: T }>;
    }
  }
  close(): void {
    this.ws.close();
  }
}

describe('gateway', () => {
  let http: Server;
  let wss: WebSocketServer;
  let rooms: RoomManager;
  let port = 0;
  const clients: Client[] = [];

  beforeEach(async () => {
    const signer = new SessionSigner();
    let gateway: Gateway;
    rooms = new RoomManager({
      deck: new PromptDeck(fixturePrompts()),
      send: (playerId, message) => gateway.send(playerId, message),
    });
    gateway = new Gateway({ rooms, signer, log: () => {} });
    http = createServer();
    wss = new WebSocketServer({ server: http, path: '/ws' });
    gateway.attach(wss);
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    port = (http.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    wss.close();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  });

  async function connect(): Promise<Client> {
    const c = await Client.connect(port);
    clients.push(c);
    return c;
  }

  it('creates a room, joins it, and reconnects with the session token', async () => {
    const ann = await connect();
    ann.send({ type: 'create_room', payload: { name: 'Ann' } });
    const welcome = await ann.until('welcome');
    const state = await ann.until('room_state');
    expect(state.payload.players.map((p) => p.name)).toEqual(['Ann']);

    const bob = await connect();
    bob.send({ type: 'join_room', payload: { code: state.payload.code, name: 'Bob' } });
    await bob.until('welcome');
    expect((await bob.until('room_state')).payload.players).toHaveLength(2);

    // Ann's tab dies and comes back with her token: same seat, no duplicate player.
    ann.close();
    const annAgain = await connect();
    annAgain.send({
      type: 'join_room',
      payload: {
        code: state.payload.code,
        name: 'Ann',
        sessionToken: welcome.payload.sessionToken,
      },
    });
    const welcomeAgain = await annAgain.until('welcome');
    expect(welcomeAgain.payload.playerId).toBe(welcome.payload.playerId);
    const after = await annAgain.until('room_state');
    expect(after.payload.players.map((p) => [p.name, p.connected])).toEqual([
      ['Ann', true],
      ['Bob', true],
    ]);
  });

  it('releases the old seat when a bound socket creates or joins another room', async () => {
    const c = await connect();
    c.send({ type: 'create_room', payload: { name: 'Hopper' } });
    await c.until('welcome');
    const first = (await c.until('room_state')).payload.code;
    await new Promise((r) => setTimeout(r, 300)); // rate limit
    c.send({ type: 'create_room', payload: { name: 'Hopper' } });
    await c.until('welcome');
    const second = (await c.until('room_state')).payload.code;
    expect(second).not.toBe(first);
    expect(rooms.get(first)!.connectedCount).toBe(0);
    expect(rooms.get(second)!.connectedCount).toBe(1);
  });

  it('releases the old seat when a bound socket joins another room with its own token', async () => {
    // Arrange
    const c = await connect();
    c.send({ type: 'create_room', payload: { name: 'Hopper' } });
    const welcome = await c.until('welcome');
    const first = (await c.until('room_state')).payload.code;
    const other = rooms.create();
    other.addPlayer('host', 'Host');
    await new Promise((r) => setTimeout(r, 300)); // rate limit
    // Act
    c.send({
      type: 'join_room',
      payload: { code: other.code, name: 'Hopper', sessionToken: welcome.payload.sessionToken },
    });
    await c.until('welcome');
    // Assert
    expect(rooms.get(first)!.connectedCount).toBe(0);
    expect(other.connectedCount).toBe(2);
  });

  it('keeps the current seat when creating a room fails because the server is full', async () => {
    // Arrange
    const c = await connect();
    c.send({ type: 'create_room', payload: { name: 'Stayer' } });
    await c.until('welcome');
    const first = (await c.until('room_state')).payload.code;
    while (rooms.size < MAX_ROOMS) rooms.create();
    await new Promise((r) => setTimeout(r, 300));
    // Act
    c.send({ type: 'create_room', payload: { name: 'Stayer' } });
    const error = await c.until('error');
    // Assert
    expect(error.payload.code).toBe('room_full');
    expect(rooms.get(first)!.connectedCount).toBe(1);
  });

  it('keeps the current seat when joining a full room fails', async () => {
    // Arrange
    const c = await connect();
    c.send({ type: 'create_room', payload: { name: 'Stayer' } });
    await c.until('welcome');
    const first = (await c.until('room_state')).payload.code;
    const full = rooms.create();
    for (let i = 0; i < LIMITS.MAX_PLAYERS; i++) full.addPlayer(`p${i}`, `P${i}`);
    await new Promise((r) => setTimeout(r, 300));
    // Act
    c.send({ type: 'join_room', payload: { code: full.code, name: 'Stayer' } });
    const error = await c.until('error');
    // Assert
    expect(error.payload.code).toBe('room_full');
    expect(rooms.get(first)!.connectedCount).toBe(1);
  });

  it('does not leak a room when the creator name is empty', async () => {
    const c = await connect();
    c.send({ type: 'create_room', payload: { name: '   ' } });
    const error = await c.until('error');
    expect(error.payload.code).toBe('bad_name');
    expect(rooms.size).toBe(0);
  });

  it('rate-limits intents and closes a socket that keeps sending garbage', async () => {
    const c = await connect();
    c.send({ type: 'create_room', payload: { name: 'Fast' } });
    await c.until('welcome');
    await c.until('room_state');
    c.send({ type: 'start_game', payload: {} });
    const limited = await c.until('error');
    expect(limited.payload.code).toBe('rate_limited');
    for (let i = 0; i < 5; i++) c.ws.send('not json');
    const [code] = (await once(c.ws, 'close')) as [number];
    expect(code).toBe(1008);
  });

  it('treats non-string payload fields as empty instead of "undefined"', async () => {
    const c = await connect();
    c.send({ type: 'create_room', payload: { name: 'Typed' } });
    await c.until('welcome');
    await c.until('room_state');
    await new Promise((r) => setTimeout(r, 300));
    c.ws.send(JSON.stringify({ type: 'add_prompt', payload: { text: 12345 } }));
    const error = await c.until('error');
    expect(error.payload.code).toBe('empty');
  });
});
