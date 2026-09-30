import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptDeck } from '../src/prompts.ts';
import { RoomManager } from '../src/roomManager.ts';
import type { Room } from '../src/room.ts';
import { encodeDrawing } from '../src/shared.ts';
import { fixturePrompts, seededRandom } from './helpers.ts';

function botRoom(): { rooms: RoomManager; room: Room } {
  const rooms = new RoomManager({
    deck: new PromptDeck(fixturePrompts(), seededRandom(7)),
    send: () => {},
    random: seededRandom(8),
  });
  const room = rooms.create('dev', true);
  room.addPlayer('dev', 'Dev');
  return { rooms, room };
}

/** The human answers everything they are dealt; bots do the rest on their own. */
function playAsHuman(room: Room): void {
  for (const prompt of room.yourPrompts('dev')) {
    if (prompt.submittedText === null) room.submitAnswer('dev', prompt.promptId, 'dev answer');
  }
  const state = room.publicState();
  if (state.phase === 'FINAL_VOTING' && !state.votedIds.includes('dev')) {
    const others = state.final!.answers.map((a) => a.playerId!).filter((id) => id !== 'dev');
    room.castFinalVotes('dev', others[0]!, others[1]!);
  }
}

describe('bot rooms', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('seats four bots with characters and leaves the human as leader', () => {
    // Given a bot room the dev joined
    const { room } = botRoom();
    const state = room.publicState();
    // Then there are four bots plus the dev, who leads
    expect(state.players).toHaveLength(5);
    const bots = state.players.filter((p) => p.id.startsWith('bot:'));
    expect(bots).toHaveLength(4);
    expect(bots.every((p) => p.characterId !== null)).toBe(true);
    expect(state.leaderId).toBe('dev');
  });

  it('plays a whole game with the bots answering and voting', () => {
    // Given a started bot room
    const { room } = botRoom();
    room.startGame('dev');
    // When time passes and the dev only plays their own part
    for (let tick = 0; tick < 1_000 && room.phase !== 'PODIUM'; tick++) {
      playAsHuman(room);
      vi.advanceTimersByTime(1_000);
    }
    // Then the game reached the podium and the bots wrote real answers
    expect(room.phase).toBe('PODIUM');
    const answers = room.publicState().final!.answers;
    const botAnswers = answers.filter((a) => a.playerId!.startsWith('bot:'));
    expect(botAnswers).toHaveLength(4);
    expect(botAnswers.every((a) => !a.autoSubmitted)).toBe(true);
  });

  it.each(['doodle', 'burn'] as const)(
    'plays a whole %s game with the bots creating too',
    (mode) => {
      // Given a bot room in a seeded mode, with the dev drawing or confessing when asked
      const { room } = botRoom();
      room.updateSettings('dev', { mode });
      room.startGame('dev');
      const scribble = encodeDrawing({ strokes: [{ color: 0, width: 1, points: [5, 5, 90, 90] }] });
      // When time passes
      for (let tick = 0; tick < 1_000 && room.phase !== 'PODIUM'; tick++) {
        const task = room
          .yourPrompts('dev')
          .find((p) => p.kind !== 'answer' && p.submittedText === null);
        if (task?.kind === 'draw') room.submitDrawing('dev', task.promptId, scribble);
        if (task?.kind === 'confess') room.submitAnswer('dev', task.promptId, 'naps');
        if (room.phase !== 'CREATING') playAsHuman(room);
        vi.advanceTimersByTime(1_000);
      }
      // Then it reached the podium on a seeded final the bots answered
      expect(room.phase).toBe('PODIUM');
      const final = room.publicState().final!;
      expect(final.seed).not.toBeNull();
      expect(final.answers.filter((a) => !a.autoSubmitted).length).toBe(5);
    },
  );

  it('keeps the room alive only while a human is connected', () => {
    // Given a bot room whose only human leaves
    const { rooms, room } = botRoom();
    room.leave('dev');
    // When the empty-lobby timer runs out
    vi.advanceTimersByTime(60_000);
    // Then the room is gone even though the bots never disconnect
    expect(rooms.get(room.code)).toBeUndefined();
  });
});
