import type { RoomPhase } from '@say-less/shared';
import { describe, expect, it } from 'vitest';
import {
  ARRANGEMENTS,
  SONGS,
  songFor,
  STEPS_PER_BAR,
  type Pattern,
  type Section,
} from '../src/audio/songs.ts';

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

const MINIMUM_LOOP_BARS: [keyof typeof ARRANGEMENTS, number][] = [
  ['lobby', 64],
  ['writing', 32],
  ['voting', 32],
  ['results', 16],
  ['podium', 32],
];

function patterns(): [string, Pattern][] {
  return Object.entries(SONGS).flatMap(([id, song]) => {
    const loop: [string, Pattern] = [`${id} loop`, song.loop];
    return song.intro ? [[`${id} intro`, song.intro] as [string, Pattern], loop] : [loop];
  });
}

function sections(): [string, Section][] {
  return Object.entries(ARRANGEMENTS).flatMap(([id, arrangement]) =>
    Object.entries(arrangement.sections).map(
      ([name, section]) => [`${id} ${name}`, section] as [string, Section],
    ),
  );
}

function arrangements() {
  return Object.entries(ARRANGEMENTS);
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

  it.each(MINIMUM_LOOP_BARS)('%s loops for at least %i bars before repeating', (id, bars) => {
    // Act
    const loop = SONGS[id].loop;

    // Assert
    expect(loop.bars).toBeGreaterThanOrEqual(bars);
  });

  it.each(arrangements())('%s loop is its arrangement played in order', (id, arrangement) => {
    // Arrange
    const expected = arrangement.form.flatMap((name) => {
      const section = arrangement.sections[name]!;
      return Array.from({ length: section.bars * STEPS_PER_BAR }, (_, step) => ({
        chord: section.chords[Math.floor(step / section.chordSteps)],
        bass: section.tracks.bass?.[step % section.tracks.bass.length] ?? '.',
        kick: section.tracks.kick?.[step % section.tracks.kick.length] ?? '.',
      }));
    });

    // Act
    const loop = SONGS[id as keyof typeof ARRANGEMENTS].loop;
    const played = expected.map((_, step) => ({
      chord: loop.chords[Math.floor(step / loop.chordSteps)],
      bass: loop.tracks.bass?.[step] ?? '.',
      kick: loop.tracks.kick?.[step] ?? '.',
    }));

    // Assert
    expect(loop.bars * STEPS_PER_BAR).toBe(expected.length);
    expect(played).toEqual(expected);
  });

  it.each(sections())('%s section has every track spanning whole bars', (_name, section) => {
    // Arrange
    const sectionSteps = section.bars * STEPS_PER_BAR;

    // Act
    const trackLengths = Object.values(section.tracks).map((track) => track.length);

    // Assert
    for (const length of trackLengths) {
      expect(length % STEPS_PER_BAR).toBe(0);
      expect(sectionSteps % length).toBe(0);
    }
  });

  it.each(sections())('%s section starts every track on a note or a rest', (_name, section) => {
    // Act
    const openings = Object.values(section.tracks).map((track) => track[0]);

    // Assert
    expect(openings).not.toContain('-');
  });

  it.each(sections())('%s section has a chord for every chord slot', (_name, section) => {
    // Arrange
    const slots = (section.bars * STEPS_PER_BAR) / section.chordSteps;

    // Act
    const chords = section.chords.length;

    // Assert
    expect(Number.isInteger(slots)).toBe(true);
    expect(chords).toBe(slots);
  });

  it.each(sections())('%s section keeps every lead note inside itself', (_name, section) => {
    // Arrange
    const sectionSteps = section.bars * STEPS_PER_BAR;

    // Act
    const ends = (section.lead ?? []).map(([step, , length]) => step + length);

    // Assert
    for (const end of ends) expect(end).toBeLessThanOrEqual(sectionSteps);
  });

  it.each(arrangements())('%s arrangement plays every section it defines', (_id, arrangement) => {
    // Act
    const defined = Object.keys(arrangement.sections).sort();
    const played = [...new Set(arrangement.form)].sort();

    // Assert
    expect(played).toEqual(defined);
  });

  it.each(arrangements())('%s wraps from its last bar back into its first', (id, arrangement) => {
    // Arrange
    const loop = SONGS[id as keyof typeof ARRANGEMENTS].loop;
    const loopSteps = loop.bars * STEPS_PER_BAR;
    const lastBar = loopSteps - STEPS_PER_BAR;
    const first = arrangement.sections[arrangement.form[0]!]!;

    // Act
    const lastChord = loop.chords[loop.chords.length - 1];
    const lastBarBass = loop.tracks.bass?.slice(lastBar) ?? '';

    // Assert
    expect(loop.chords[0]).toBe(first.chords[0]);
    expect(lastChord).not.toBe(loop.chords[0]);
    expect(lastBarBass).toContain('a');
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
