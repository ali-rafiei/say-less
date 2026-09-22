import type { Prompt, RoundIndex, ServerMessage } from '../src/shared.ts';
import { PromptDeck } from '../src/prompts.ts';
import { Room } from '../src/room.ts';

export function fixturePrompts(): Prompt[] {
  const prompts: Prompt[] = [];
  for (let i = 0; i < 40; i++) {
    prompts.push({ id: `p${String(i).padStart(3, '0')}`, text: `Prompt ${i}`, rounds: [0, 1, 2] });
  }
  return prompts;
}

/** Deterministic PRNG so shuffles are reproducible across runs. */
export function seededRandom(seed = 42): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Harness {
  room: Room;
  inbox: Map<string, ServerMessage[]>;
  last<T extends ServerMessage['type']>(
    playerId: string,
    type: T,
  ): Extract<ServerMessage, { type: T }> | undefined;
  state(): ReturnType<Room['publicState']>;
}

export function makeRoom(playerIds: string[] = ['a', 'b', 'c'], seed = 42): Harness {
  const inbox = new Map<string, ServerMessage[]>();
  const room = new Room('TEST', {
    deck: new PromptDeck(fixturePrompts(), seededRandom(seed)),
    send: (playerId, message) => {
      const list = inbox.get(playerId) ?? [];
      list.push(message);
      inbox.set(playerId, list);
    },
    random: seededRandom(seed + 1),
  });
  for (const id of playerIds) room.addPlayer(id, id.toUpperCase());
  return {
    room,
    inbox,
    last: (playerId, type) =>
      [...(inbox.get(playerId) ?? [])].reverse().find((m) => m.type === type) as never,
    state: () => room.publicState(),
  };
}

export function startToWriting(h: Harness, round: RoundIndex = 0): void {
  const leader = h.room.leaderId;
  const chars = ['lemon', 'raccoon', 'icecream', 'grandma', 'sock', 'cactus', 'toast', 'pigeon'];
  h.room.players.forEach((p, i) => h.room.pickCharacter(p.id, chars[i]!));
  h.room.startGame(leader);
  expect(h.room.phase).toBe('ROUND_INTRO');
  vi.advanceTimersByTime(4_000);
  if (round === 0) return;
  throw new Error('startToWriting only handles round 0; drive later rounds explicitly');
}

/** Advance fake time to the current phase's deadline (whatever the server chose). */
export function advanceToPhaseEnd(h: Harness): void {
  const endsAt = h.room.phaseEndsAt;
  if (endsAt === null) throw new Error(`Phase ${h.room.phase} has no timer`);
  vi.advanceTimersByTime(Math.max(endsAt - Date.now(), 0));
}

/** Everyone answers with text that reveals the author for the voter scripts. */
export function answerAll(h: Harness, wordsFor: (playerId: string, limit: number) => string): void {
  for (const player of h.room.players) {
    for (const prompt of h.room.yourPrompts(player.id)) {
      if (prompt.submittedText === null) {
        h.room.submitAnswer(player.id, prompt.promptId, wordsFor(player.id, prompt.effectiveLimit));
      }
    }
  }
}

import { expect, vi } from 'vitest';
