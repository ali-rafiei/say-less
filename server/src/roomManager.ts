import { EMPTY_ROOM_TTL_MS, MAX_ROOMS, type ServerMessage } from './shared.ts';
import type { PromptDeck } from './prompts.ts';
import { Room, RoomError } from './room.ts';
import { generateRoomCode } from './roomCode.ts';

export interface RoomManagerDeps {
  deck: PromptDeck;
  send: (playerId: string, message: ServerMessage) => void;
  random?: () => number;
  log?: (message: string, fields?: Record<string, unknown>) => void;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly deps: RoomManagerDeps) {}

  get size(): number {
    return this.rooms.size;
  }

  create(): Room {
    if (this.rooms.size >= MAX_ROOMS) {
      throw new RoomError('room_full', 'The server is full right now. Try again in a few minutes.');
    }
    let code = generateRoomCode(this.deps.random);
    while (this.rooms.has(code)) code = generateRoomCode(this.deps.random);
    const room = new Room(code, {
      deck: this.deps.deck,
      send: this.deps.send,
      onEmpty: (emptied) => this.scheduleExpiry(emptied),
      ...(this.deps.random ? { random: this.deps.random } : {}),
    });
    this.rooms.set(code, room);
    this.deps.log?.('room created', { code });
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  require(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('not_found', 'No room with that code');
    return room;
  }

  /** Called when a player connects; cancels a pending expiry. */
  touch(code: string): void {
    const timer = this.expiryTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(code);
    }
  }

  private scheduleExpiry(room: Room): void {
    this.touch(room.code);
    const timer = setTimeout(() => {
      this.expiryTimers.delete(room.code);
      if (room.connectedCount === 0) this.destroy(room.code);
    }, EMPTY_ROOM_TTL_MS);
    this.expiryTimers.set(room.code, timer);
  }

  destroy(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.close();
    this.rooms.delete(code);
    this.touch(code);
    this.deps.log?.('room closed', { code });
  }
}
