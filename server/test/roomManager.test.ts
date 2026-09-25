import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptDeck } from '../src/prompts.ts';
import { RoomManager } from '../src/roomManager.ts';
import {
  EMPTY_LOBBY_TTL_MS,
  EMPTY_ROOM_TTL_MS,
  LIMITS,
  ROOM_CREATION_WINDOW_MS,
} from '../src/shared.ts';
import { fixturePrompts } from './helpers.ts';

function makeManager(): RoomManager {
  return new RoomManager({ deck: new PromptDeck(fixturePrompts()), send: () => {} });
}

describe('room creation limits', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refuses more live rooms from one client than the cap, but not from another client', () => {
    // Arrange
    const rooms = makeManager();
    for (let i = 0; i < LIMITS.MAX_LIVE_ROOMS_PER_CLIENT; i++) rooms.create('home');
    // Act / Assert
    expect(() => rooms.create('home')).toThrowError(
      expect.objectContaining({ code: 'rate_limited' }),
    );
    expect(() => rooms.create('elsewhere')).not.toThrow();
  });

  it('frees a live-room slot when one of the client rooms closes', () => {
    const rooms = makeManager();
    const created = Array.from({ length: LIMITS.MAX_LIVE_ROOMS_PER_CLIENT }, () =>
      rooms.create('home'),
    );
    rooms.destroy(created[0]!.code);
    expect(() => rooms.create('home')).not.toThrow();
  });

  it('caps creations per window even when the rooms are gone, and resets after the window', () => {
    // Arrange: create and close rooms until the window budget is spent
    const rooms = makeManager();
    for (let i = 0; i < LIMITS.ROOM_CREATIONS_PER_WINDOW; i++) {
      rooms.destroy(rooms.create('home').code);
    }
    // Act / Assert
    expect(() => rooms.create('home')).toThrowError(
      expect.objectContaining({ code: 'rate_limited' }),
    );
    vi.advanceTimersByTime(ROOM_CREATION_WINDOW_MS);
    expect(() => rooms.create('home')).not.toThrow();
  });
});

describe('empty room expiry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('closes an abandoned lobby that never started a game soon after it empties', () => {
    // Arrange
    const rooms = makeManager();
    const room = rooms.create('home');
    room.addPlayer('x', 'X');
    // Act
    room.disconnect('x');
    vi.advanceTimersByTime(EMPTY_LOBBY_TTL_MS);
    // Assert
    expect(rooms.get(room.code)).toBeUndefined();
  });

  it('keeps an emptied room whose game has started for the full hold', () => {
    // Arrange
    const rooms = makeManager();
    const room = rooms.create('home');
    for (const id of ['x', 'y', 'z']) room.addPlayer(id, id);
    room.startGame('x');
    // Act
    for (const id of ['x', 'y', 'z']) room.disconnect(id);
    vi.advanceTimersByTime(EMPTY_LOBBY_TTL_MS);
    // Assert
    expect(rooms.get(room.code)).toBe(room);
    vi.advanceTimersByTime(EMPTY_ROOM_TTL_MS - EMPTY_LOBBY_TTL_MS);
    expect(rooms.get(room.code)).toBeUndefined();
  });
});
