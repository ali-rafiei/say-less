import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SUBMIT_TEXT, countWords } from '../src/shared.ts';
import { advanceToPhaseEnd, answerAll, makeRoom, startToWriting, type Harness } from './helpers.ts';

/** Players who wrote the open matchup (from their own prompts; the public state hides them). */
function authorsOf(h: Harness, matchupIndex: number): string[] {
  return h.room.players
    .filter((p) => h.room.yourPrompts(p.id).some((x) => x.matchupIndex === matchupIndex))
    .map((p) => p.id);
}

function fillAnswers(h: Harness): void {
  answerAll(h, (id, limit) => `${id} ${'x '.repeat(Math.max((limit ?? 2) - 1, 0))}`.trim());
}

function viewer(h: Harness, id: string) {
  return h.last(id, 'room_state')!.payload;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('timer speed', () => {
  it('waits on the leader instead of a clock when timers are off', () => {
    // Arrange
    const h = makeRoom();
    h.room.updateSettings('a', { timers: 'off' });
    startToWriting(h);
    // Act: half an hour passes with nobody writing
    vi.advanceTimersByTime(30 * 60_000);
    // Assert: still writing, and only the leader can move the room on
    expect(h.room.phase).toBe('WRITING');
    expect(h.room.phaseEndsAt).toBeNull();
    expect(() => h.room.advancePhase('b')).toThrowError(
      expect.objectContaining({ code: 'not_leader' }),
    );
    h.room.advancePhase('a');
    expect(h.room.phase).toBe('VOTING');
    expect(h.state().matchups[h.state().currentMatchupIndex]!.answers[0].text).toBe(
      AUTO_SUBMIT_TEXT,
    );
  });

  it('doubles the writing clock on relaxed timers', () => {
    const h = makeRoom();
    h.room.updateSettings('a', { timers: 'relaxed' });
    startToWriting(h);
    expect(h.room.phaseEndsAt! - Date.now()).toBe(240_000);
    expect(() => h.room.advancePhase('a')).toThrowError(
      expect.objectContaining({ code: 'invalid' }),
    );
  });
});

describe('pause', () => {
  it('freezes the clock and refuses answers until the leader resumes', () => {
    // Arrange: 30 s into a 120 s writing phase
    const h = makeRoom();
    startToWriting(h);
    vi.advanceTimersByTime(30_000);
    // Act
    h.room.pauseGame('a');
    vi.advanceTimersByTime(10 * 60_000);
    // Assert: nothing moved, nothing can be sent
    expect(h.room.phase).toBe('WRITING');
    expect(h.state().paused).toEqual({ byName: 'A', remainingMs: 90_000 });
    const prompt = h.room.yourPrompts('b')[0]!;
    expect(() => h.room.submitAnswer('b', prompt.promptId, 'hello')).toThrowError(
      expect.objectContaining({ code: 'paused' }),
    );
    // Act: resume picks up the remaining 90 s
    h.room.resumeGame('a');
    expect(h.room.phaseEndsAt! - Date.now()).toBe(90_000);
    vi.advanceTimersByTime(90_000);
    expect(h.room.phase).toBe('VOTING');
  });

  it('refuses a Doodle drawing while paused', () => {
    // Arrange: drawing phase of a Doodle game
    const h = makeRoom();
    h.room.updateSettings('a', { mode: 'doodle' });
    startToWriting(h);
    const task = h.room.yourPrompts('a')[0]!;
    expect(task.kind).toBe('draw');
    // Act
    h.room.pauseGame('a');
    // Assert
    expect(() => h.room.submitDrawing('a', task.promptId, 'anything')).toThrowError(
      expect.objectContaining({ code: 'paused' }),
    );
  });

  it('does not let a disconnect end the phase while paused', () => {
    // Arrange: everyone but c has answered
    const h = makeRoom();
    startToWriting(h);
    for (const id of ['a', 'b']) {
      for (const p of h.room.yourPrompts(id)) h.room.submitAnswer(id, p.promptId, `${id} words`);
    }
    h.room.pauseGame('a');
    // Act: c, the last writer, drops out past the grace period
    h.room.disconnect('c');
    vi.advanceTimersByTime(60_000);
    // Assert: held until the leader resumes
    expect(h.room.phase).toBe('WRITING');
    h.room.resumeGame('a');
    // Writing closes on resume. A first matchup of a against b has no one left to vote
    // (c is gone), so it goes straight to its reveal; one with c in it waits for votes.
    expect(['VOTING', 'MATCHUP_REVEAL']).toContain(h.room.phase);
  });
});

describe('bail out', () => {
  it('files a stock answer within the limit and stamps it only at the reveal', () => {
    // Arrange
    const h = makeRoom();
    startToWriting(h);
    const prompt = h.room.yourPrompts('a')[0]!;
    // Act
    h.room.bailOut('a', prompt.promptId);
    fillAnswers(h);
    // Assert: hidden while voting, shown at the reveal of a's matchup
    const stock = h.room.yourPrompts('a').find((p) => p.promptId === prompt.promptId)!;
    expect(countWords(stock.submittedText!)).toBeLessThanOrEqual(12);
    let stamped = 0;
    while (h.room.phase !== 'ROUND_RESULTS') {
      const open = h.state().matchups[h.state().currentMatchupIndex]!;
      if (h.room.phase === 'VOTING') {
        expect(open.answers.some((a) => a.bailOut)).toBe(false);
        vi.advanceTimersByTime(20_000);
      } else {
        stamped += open.answers.filter((a) => a.bailOut && a.playerId === 'a').length;
        advanceToPhaseEnd(h);
      }
    }
    expect(stamped).toBe(1);
  });

  it('is refused when the leader turns Bail Outs off', () => {
    const h = makeRoom();
    h.room.updateSettings('a', { bailOuts: false });
    startToWriting(h);
    expect(() => h.room.bailOut('a', h.room.yourPrompts('a')[0]!.promptId)).toThrowError(
      expect.objectContaining({ code: 'invalid' }),
    );
  });
});

describe('audience', () => {
  it('seats a mid-game joiner in the audience, whose vote decides only the Crowd Favourite', () => {
    // Arrange
    const h = makeRoom();
    startToWriting(h);
    // Act
    expect(h.room.addPlayer('z', 'Zed')).toBe('audience');
    fillAnswers(h);
    const index = h.state().currentMatchupIndex;
    h.room.castVote('z', index, 0);
    // Assert: the audience vote does not hold up or count toward the player vote
    expect(viewer(h, 'z').viewer.role).toBe('audience');
    expect(h.room.phase).toBe('VOTING');
    const voter = h.room.players.find((p) => !authorsOf(h, index).includes(p.id))!;
    h.room.castVote(voter.id, index, 1);
    expect(h.room.phase).toBe('MATCHUP_REVEAL');
    const matchup = h.state().matchups[index]!;
    expect(matchup.result!.voteCounts).toEqual([0, 1]);
    expect(matchup.result!.audienceCounts).toEqual([1, 0]);
    expect(matchup.result!.awards).toContainEqual({
      playerId: matchup.answers[0].playerId,
      kind: 'crowd',
      points: 100,
    });
  });

  it('gives a freed lobby seat to the first waiting audience member', () => {
    const h = makeRoom();
    h.room.updateSettings('a', { maxPlayers: 3 });
    expect(h.room.addPlayer('d', 'D')).toBe('audience');
    h.room.leave('c');
    expect(h.room.players.map((p) => p.id)).toEqual(['a', 'b', 'd']);
  });
});

describe('leader moderation', () => {
  it('shuts a kicked player out mid-game while their seat stays for the matchups', () => {
    // Arrange
    const h = makeRoom(['a', 'b', 'c', 'd']);
    startToWriting(h);
    const prompt = h.room.yourPrompts('d')[0]!;
    // Act
    h.room.kickPlayer('a', 'd');
    // Assert
    expect(h.last('d', 'left')).toBeDefined();
    expect(h.room.hasPlayer('d')).toBe(false);
    expect(h.room.players.some((p) => p.id === 'd')).toBe(true);
    expect(() => h.room.submitAnswer('d', prompt.promptId, 'still here')).toThrowError(
      expect.objectContaining({ code: 'not_found' }),
    );
    expect(() => h.room.kickPlayer('b', 'c')).toThrowError(
      expect.objectContaining({ code: 'not_leader' }),
    );
  });
});

describe('initials mode', () => {
  it('deals five letters in round 1 and holds answers to them', () => {
    // Arrange
    const h = makeRoom();
    h.room.updateSettings('a', { mode: 'initials' });
    startToWriting(h);
    const prompt = h.room.yourPrompts('a')[0]!;
    // Assert
    expect(prompt.letters).toMatch(/^[A-Z]{5}$/);
    expect(prompt.effectiveLimit).toBe(5);
    expect(() => h.room.submitAnswer('a', prompt.promptId, 'zz zz zz zz zz')).toThrowError(
      expect.objectContaining({ code: 'bad_initials' }),
    );
    const fitting = Array.from(prompt.letters!, (l) => `${l}oo`).join(' ');
    h.room.submitAnswer('a', prompt.promptId, fitting);
    expect(h.room.yourPrompts('a')[0]!.submittedText).toBe(fitting);
  });
});

describe('short game and anonymous final', () => {
  it('goes from round 1 to a final whose wall hides authors until the reveal', () => {
    // Arrange
    const h = makeRoom();
    h.room.updateSettings('a', { length: 'short', anonymousFinal: true });
    startToWriting(h);
    fillAnswers(h);
    while (h.room.phase !== 'ROUND_RESULTS') {
      if (h.room.phase === 'VOTING') vi.advanceTimersByTime(20_000);
      else advanceToPhaseEnd(h);
    }
    // Act
    advanceToPhaseEnd(h); // results
    expect(h.state().roundIndex).toBe(2);
    advanceToPhaseEnd(h); // intro
    fillAnswers(h);
    // Assert: anonymous wall, votes by opaque id only
    expect(h.room.phase).toBe('FINAL_VOTING');
    const wall = viewer(h, 'a').final!.answers;
    expect(wall.every((x) => x.playerId === null)).toBe(true);
    const mine = viewer(h, 'a').viewer.finalAnswerId;
    const others = wall.filter((x) => x.answerId !== mine).map((x) => x.answerId!);
    expect(() => h.room.castFinalVotes('a', 'b', 'c')).toThrowError(
      expect.objectContaining({ code: 'invalid' }),
    );
    expect(() => h.room.castFinalVotes('a', mine!, others[0]!)).toThrowError(
      expect.objectContaining({ code: 'invalid' }),
    );
    h.room.castFinalVotes('a', others[0]!, others[1]!);
    for (const id of ['b', 'c']) {
      const own = viewer(h, id).viewer.finalAnswerId;
      const picks = wall.filter((x) => x.answerId !== own).map((x) => x.answerId!);
      h.room.castFinalVotes(id, picks[0]!, picks[1]!);
    }
    expect(h.room.phase).toBe('FINAL_REVEAL');
    expect(h.state().final!.answers.every((x) => x.playerId !== null)).toBe(true);
  });
});
