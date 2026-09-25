import type { RoomPhase } from '@say-less/shared';
import { describe, expect, it } from 'vitest';
import { SONGS, songFor, STEPS_PER_BAR, type Pattern } from '../src/audio/songs.ts';

const PHASES: RoomPhase[] = [
  'LOBBY',
  'ROUND_INTRO',
  'WRITING',
  'VOTING',
  'MATCHUP_REVEAL',
  'ROUND_RESULTS',
  'FINAL_WRITING',
  'FINAL_VOTING',
  'PODIUM',
];

function patterns(): [string, Pattern][] {
  return Object.entries(SONGS).flatMap(([id, song]) => {
    const loop: [string, Pattern] = [`${id} loop`, song.loop];
    return song.intro ? [[`${id} intro`, song.intro] as [string, Pattern], loop] : [loop];
  });
}

describe('songs', () => {
  it.each(patterns())('%s has every track spanning whole bars', (_name, pattern) => {
    // Arrange
    const loopSteps = pattern.bars * STEPS_PER_BAR;

    // Act
    const trackLengths = Object.values(pattern.tracks).map((track) => track.length);

    // Assert
    for (const length of trackLengths) {
      expect(length === STEPS_PER_BAR || length === loopSteps).toBe(true);
    }
  });

  it.each(patterns())('%s has a chord for every chord slot', (_name, pattern) => {
    // Arrange
    const slots = (pattern.bars * STEPS_PER_BAR) / pattern.chordSteps;

    // Act
    const chords = pattern.chords.length;

    // Assert
    expect(Number.isInteger(slots)).toBe(true);
    expect(chords).toBe(slots);
  });

  it.each(patterns())('%s keeps every lead note inside the loop', (_name, pattern) => {
    // Arrange
    const loopSteps = pattern.bars * STEPS_PER_BAR;

    // Act
    const ends = (pattern.lead ?? []).map(([step, , length]) => step + length);

    // Assert
    for (const end of ends) expect(end).toBeLessThanOrEqual(loopSteps);
  });

  it('drops the music out for the matchup reveal so its effects land', () => {
    // Act
    const song = songFor('MATCHUP_REVEAL');

    // Assert
    expect(song).toBeNull();
  });

  it('gives every other phase and the home screen a song', () => {
    // Act
    const missing = [...PHASES.filter((p) => p !== 'MATCHUP_REVEAL'), null].filter(
      (phase) => songFor(phase) === null,
    );

    // Assert
    expect(missing).toEqual([]);
  });

  it('runs the round intro fill straight into the writing loop', () => {
    // Act
    const intro = songFor('ROUND_INTRO');

    // Assert
    expect(intro?.intro).toBeDefined();
    expect(intro?.loop).toBe(songFor('WRITING')?.loop);
    expect(songFor('FINAL_WRITING')).toBe(songFor('WRITING'));
  });
});
