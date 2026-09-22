import {
  CLIENT_MESSAGE_TYPES,
  LIMITS,
  RATE_LIMIT_MS,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
} from './shared.ts';
import type { WebSocket, WebSocketServer } from 'ws';
import { RoomError } from './room.ts';
import { normalizeRoomCode } from './roomCode.ts';
import type { RoomManager } from './roomManager.ts';
import type { SessionSigner } from './session.ts';

interface Connection {
  socket: WebSocket;
  playerId: string | null;
  roomCode: string | null;
  lastIntentAt: number;
  alive: boolean;
}

export interface GatewayDeps {
  rooms: RoomManager;
  signer: SessionSigner;
  log: (message: string, fields?: Record<string, unknown>) => void;
}

/**
 * Socket <-> player plumbing. Rooms never see sockets; they call `send(playerId)`
 * and this class routes it to whichever socket currently owns that player.
 */
export class Gateway {
  private readonly connections = new Set<Connection>();
  private readonly byPlayer = new Map<string, Connection>();

  constructor(private readonly deps: GatewayDeps) {}

  attach(server: WebSocketServer): void {
    server.on('connection', (socket) => this.onConnection(socket));
    const heartbeat = setInterval(() => {
      for (const conn of this.connections) {
        if (!conn.alive) {
          conn.socket.terminate();
          continue;
        }
        conn.alive = false;
        conn.socket.ping();
      }
    }, 30_000);
    server.on('close', () => clearInterval(heartbeat));
  }

  send(playerId: string, message: ServerMessage): void {
    const conn = this.byPlayer.get(playerId);
    if (!conn || conn.socket.readyState !== conn.socket.OPEN) return;
    conn.socket.send(JSON.stringify(message));
  }

  private onConnection(socket: WebSocket): void {
    const conn: Connection = {
      socket,
      playerId: null,
      roomCode: null,
      lastIntentAt: 0,
      alive: true,
    };
    this.connections.add(conn);
    socket.on('pong', () => {
      conn.alive = true;
    });
    socket.on('message', (raw) => this.onMessage(conn, raw.toString()));
    socket.on('close', () => this.onClose(conn));
    socket.on('error', (error) => this.deps.log('socket error', { error: String(error) }));
  }

  private onClose(conn: Connection): void {
    this.connections.delete(conn);
    if (conn.playerId && this.byPlayer.get(conn.playerId) === conn) {
      this.byPlayer.delete(conn.playerId);
      if (conn.roomCode) this.deps.rooms.get(conn.roomCode)?.disconnect(conn.playerId);
    }
  }

  private onMessage(conn: Connection, raw: string): void {
    let message: ClientMessage;
    try {
      message = parseClientMessage(raw);
    } catch (error) {
      this.error(conn, 'invalid', error instanceof Error ? error.message : 'Bad message');
      return;
    }
    if (message.type === 'ping') {
      conn.socket.send(JSON.stringify({ type: 'pong', payload: { serverTime: Date.now() } }));
      return;
    }
    const now = Date.now();
    if (now - conn.lastIntentAt < RATE_LIMIT_MS) {
      this.error(conn, 'rate_limited', 'Slow down');
      return;
    }
    conn.lastIntentAt = now;
    try {
      this.dispatch(conn, message);
    } catch (error) {
      if (error instanceof RoomError) {
        this.error(conn, error.code, error.message);
      } else {
        this.deps.log('unhandled intent error', {
          type: message.type,
          error: error instanceof Error ? error.stack : String(error),
        });
        this.error(conn, 'invalid', 'Something went wrong on the server');
      }
    }
  }

  private dispatch(conn: Connection, message: ClientMessage): void {
    switch (message.type) {
      case 'create_room': {
        const room = this.deps.rooms.create();
        const playerId = this.deps.signer.newPlayerId();
        room.addPlayer(playerId, message.payload.name);
        this.bind(conn, room.code, playerId);
        return;
      }
      case 'join_room': {
        const code = normalizeRoomCode(message.payload.code);
        const room = this.deps.rooms.require(code);
        const returning = this.deps.signer.verify(message.payload.sessionToken);
        if (returning && room.hasPlayer(returning)) {
          this.bind(conn, room.code, returning, true);
          return;
        }
        const playerId = this.deps.signer.newPlayerId();
        room.addPlayer(playerId, message.payload.name);
        this.bind(conn, room.code, playerId);
        return;
      }
      case 'leave_room': {
        const { room, playerId } = this.requireBound(conn);
        room.leave(playerId);
        this.byPlayer.delete(playerId);
        conn.playerId = null;
        conn.roomCode = null;
        conn.socket.send(JSON.stringify({ type: 'left', payload: {} } satisfies ServerMessage));
        return;
      }
      default: {
        const { room, playerId } = this.requireBound(conn);
        this.dispatchInRoom(room, playerId, message);
      }
    }
  }

  private dispatchInRoom(
    room: NonNullable<ReturnType<RoomManager['get']>>,
    playerId: string,
    message: ClientMessage,
  ): void {
    switch (message.type) {
      case 'update_settings':
        room.updateSettings(playerId, message.payload);
        return;
      case 'start_game':
        room.startGame(playerId);
        return;
      case 'pick_character':
        room.pickCharacter(playerId, String(message.payload.characterId));
        return;
      case 'add_prompt':
        room.addPrompt(playerId, String(message.payload.text));
        return;
      case 'remove_prompt':
        room.removePrompt(playerId, String(message.payload.promptId));
        return;
      case 'spend_roast':
        room.spendRoast(playerId, String(message.payload.targetId));
        return;
      case 'submit_answer':
        room.submitAnswer(playerId, String(message.payload.promptId), String(message.payload.text));
        return;
      case 'cast_vote': {
        const { matchupIndex, answerIndex } = message.payload;
        if (answerIndex !== 0 && answerIndex !== 1)
          throw new RoomError('invalid', 'answerIndex must be 0 or 1');
        room.castVote(playerId, Number(matchupIndex), answerIndex);
        return;
      }
      case 'cast_final_votes':
        room.castFinalVotes(
          playerId,
          String(message.payload.first),
          String(message.payload.second),
        );
        return;
      case 'rematch':
        room.rematch(playerId);
        return;
      default:
        throw new RoomError('invalid', `Unexpected message ${message.type}`);
    }
  }

  private bind(conn: Connection, code: string, playerId: string, returning = false): void {
    const previous = this.byPlayer.get(playerId);
    if (previous && previous !== conn) {
      // A second tab for the same session takes over; the old one goes quiet.
      previous.playerId = null;
      previous.roomCode = null;
    }
    conn.playerId = playerId;
    conn.roomCode = code;
    this.byPlayer.set(playerId, conn);
    this.deps.rooms.touch(code);
    conn.socket.send(
      JSON.stringify({
        type: 'welcome',
        payload: { playerId, sessionToken: this.deps.signer.sign(playerId), code },
      } satisfies ServerMessage),
    );
    const room = this.deps.rooms.require(code);
    if (returning) room.reconnect(playerId);
    else room.reconnect(playerId);
  }

  private requireBound(conn: Connection): {
    room: NonNullable<ReturnType<RoomManager['get']>>;
    playerId: string;
  } {
    if (!conn.playerId || !conn.roomCode) throw new RoomError('not_found', 'Join a room first');
    const room = this.deps.rooms.get(conn.roomCode);
    if (!room || !room.hasPlayer(conn.playerId))
      throw new RoomError('not_found', 'That room is gone');
    return { room, playerId: conn.playerId };
  }

  private error(conn: Connection, code: ErrorCode, message: string): void {
    if (conn.socket.readyState !== conn.socket.OPEN) return;
    conn.socket.send(
      JSON.stringify({ type: 'error', payload: { code, message } } satisfies ServerMessage),
    );
  }
}

export function parseClientMessage(raw: string): ClientMessage {
  if (raw.length > 4_096) throw new Error('Message too large');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Message is not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Message must be an object');
  const { type, payload } = parsed as { type?: unknown; payload?: unknown };
  if (typeof type !== 'string' || !CLIENT_MESSAGE_TYPES.includes(type as ClientMessage['type'])) {
    throw new Error('Unknown message type');
  }
  if (payload !== undefined && (typeof payload !== 'object' || payload === null)) {
    throw new Error('payload must be an object');
  }
  const body = (payload ?? {}) as Record<string, unknown>;
  if ((type === 'create_room' || type === 'join_room') && typeof body.name !== 'string') {
    throw new Error('name is required');
  }
  if (type === 'join_room' && typeof body.code !== 'string') throw new Error('code is required');
  if (typeof body.name === 'string' && body.name.length > LIMITS.NAME_MAX * 4) {
    throw new Error('name is too long');
  }
  return { type, payload: body } as ClientMessage;
}
