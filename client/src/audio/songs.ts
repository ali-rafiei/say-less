import type { RoomPhase } from '@say-less/shared';

export const STEPS_PER_BAR = 16;

/** MIDI numbers: `root` for the bass, `notes` the voiced upper structure. */
export interface Chord {
  root: number;
  notes: number[];
}

export type KeysVoice = 'epiano' | 'pad' | 'pluck' | 'clav' | 'brass';

/**
 * One character per 16th step; a track 16 long repeats every bar.
 * Drums: x hit, X accent, g ghost, o open hat. Tick: X tick, x tock.
 * Bass: r root, o octave, f fifth, l fifth below, a approach to the next chord.
 * Keys: x hit, g soft hit. Keys, bass and riser notes last one step plus one per following '-'.
 */
export interface Tracks {
  kick?: string;
  snare?: string;
  hat?: string;
  tick?: string;
  crash?: string;
  riser?: string;
  bass?: string;
  keys?: string;
}

export type LeadNote = [step: number, midi: number, length: number];

export type MixChannel = keyof Tracks | 'lead';

export interface Pattern {
  bpm: number;
  bars: number;
  /** Fraction of a 16th that off-beat 16ths are pushed late. */
  swing: number;
  chordSteps: number;
  chords: Chord[];
  keys: KeysVoice;
  tracks: Tracks;
  lead?: LeadNote[];
  mix: Partial<Record<MixChannel, number>>;
}

export interface Song {
  id: string;
  /** Played once, then the loop starts with a crash when `land` is set. */
  intro?: Pattern;
  land?: boolean;
  loop: Pattern;
}

const F_MAJ9: Chord = { root: 41, notes: [57, 60, 64, 67] };
const D_M7: Chord = { root: 38, notes: [57, 60, 65, 69] };
const BB_MAJ7: Chord = { root: 46, notes: [57, 62, 65, 69] };
const C_9SUS: Chord = { root: 48, notes: [58, 62, 65, 67] };

const A_M9: Chord = { root: 45, notes: [60, 64, 67, 71] };
const F_MAJ9_HIGH: Chord = { root: 41, notes: [60, 64, 67, 69] };
const D_M9: Chord = { root: 38, notes: [60, 64, 65, 69] };
const E_7SUS: Chord = { root: 40, notes: [59, 62, 64, 69] };
const E_7: Chord = { root: 40, notes: [59, 62, 64, 68] };

const C_TRIAD: Chord = { root: 48, notes: [60, 64, 67] };
const A_MINOR: Chord = { root: 45, notes: [60, 64, 69] };
const D_M7_TRIAD: Chord = { root: 50, notes: [60, 65, 69] };
const G_7: Chord = { root: 43, notes: [59, 65, 67] };

const G_13: Chord = { root: 43, notes: [59, 64, 65, 69] };
const BB_BRASS: Chord = { root: 46, notes: [58, 62, 65, 70] };
const C_BRASS: Chord = { root: 48, notes: [60, 64, 67, 72] };
const D_BRASS: Chord = { root: 50, notes: [62, 66, 69, 74] };
const F_BRASS: Chord = { root: 41, notes: [60, 65, 69, 72] };
const G_BRASS: Chord = { root: 43, notes: [59, 62, 67, 71] };

const D_M9_LOW: Chord = { root: 38, notes: [57, 60, 64, 65] };
const G_13_LOW: Chord = { root: 43, notes: [57, 59, 64, 65] };
const C_MAJ9: Chord = { root: 48, notes: [55, 59, 62, 64] };
const A_7B9: Chord = { root: 45, notes: [55, 58, 61, 64] };

/** F major, 92 bpm, swung: I–vi–IV–V (Fmaj9 Dm7 B♭maj7 C9sus), pentatonic answer in bars 5–8. */
const LOBBY: Pattern = {
  bpm: 92,
  bars: 8,
  swing: 0.16,
  chordSteps: 16,
  chords: [F_MAJ9, D_M7, BB_MAJ7, C_9SUS, F_MAJ9, D_M7, BB_MAJ7, C_9SUS],
  keys: 'epiano',
  tracks: {
    kick: 'X.....x...x.....',
    snare: '....x.......x...',
    hat: 'x.x.x.xgx.x.x.xg',
    bass: 'r-----r-o--.f-a.',
    keys: 'x------x--------',
  },
  lead: [
    [72, 72, 2],
    [74, 74, 2],
    [76, 77, 4],
    [80, 74, 2],
    [82, 72, 2],
    [84, 69, 8],
    [104, 69, 2],
    [106, 72, 2],
    [108, 74, 4],
    [112, 72, 2],
    [114, 69, 2],
    [116, 67, 10],
  ],
  mix: { kick: 0.8, snare: 0.35, hat: 0.3, bass: 0.7, keys: 0.5, lead: 0.4 },
};

/** A minor, 96 bpm: i–VI–iv–V (Am9 Fmaj9 Dm9 E7sus4) pads over a clock tick-tock. */
const WRITING: Pattern = {
  bpm: 96,
  bars: 8,
  swing: 0,
  chordSteps: 16,
  chords: [A_M9, F_MAJ9_HIGH, D_M9, E_7SUS, A_M9, F_MAJ9_HIGH, D_M9, E_7SUS],
  keys: 'pad',
  tracks: {
    tick: 'X...x...X...x...',
    kick: 'x...............',
    bass: 'r.r.r.r.r.r.r.r.',
    keys: 'x---------------',
  },
  lead: [
    [72, 76, 4],
    [76, 79, 4],
    [80, 76, 8],
    [88, 74, 8],
    [96, 72, 12],
  ],
  mix: { tick: 0.5, kick: 0.5, bass: 0.45, keys: 0.5, lead: 0.25 },
};

/** One bar on E7: snare fill and noise riser landing on the writing loop's Am9. */
const ROUND_FILL: Pattern = {
  bpm: 96,
  bars: 1,
  swing: 0,
  chordSteps: 16,
  chords: [E_7],
  keys: 'pad',
  tracks: {
    snare: 'g.g.g.g.x.x.xxXX',
    kick: 'x.......x...x.x.',
    riser: 'x---------------',
    bass: 'r---------------',
    keys: 'x---------------',
  },
  mix: { snare: 0.6, kick: 0.8, riser: 0.5, bass: 0.55, keys: 0.5 },
};

/** C major, 124 bpm: I–vi–ii–V (C Am Dm7 G7), octave bass, off-beat stabs, pentatonic hook. */
const VOTING: Pattern = {
  bpm: 124,
  bars: 8,
  swing: 0,
  chordSteps: 16,
  chords: [C_TRIAD, A_MINOR, D_M7_TRIAD, G_7, C_TRIAD, A_MINOR, D_M7_TRIAD, G_7],
  keys: 'pluck',
  tracks: {
    kick: 'X...x...X...x...',
    snare: '....x.......x...',
    hat: 'x.o.x.o.x.o.x.o.',
    bass: 'r.o.r.o.r.o.f.a.',
    keys: '..x...x...x...x.',
  },
  lead: [
    [64, 67, 2],
    [66, 69, 2],
    [68, 72, 2],
    [70, 76, 4],
    [74, 74, 2],
    [76, 72, 4],
    [80, 69, 2],
    [82, 72, 2],
    [84, 76, 2],
    [86, 79, 6],
    [96, 81, 2],
    [98, 79, 2],
    [100, 76, 2],
    [102, 74, 2],
    [104, 72, 2],
    [106, 69, 6],
    [112, 67, 2],
    [114, 69, 2],
    [116, 74, 4],
    [120, 76, 2],
    [122, 74, 6],
  ],
  mix: { kick: 0.8, snare: 0.45, hat: 0.3, bass: 0.65, keys: 0.5, lead: 0.4 },
};

/** B♭–C–D brass "ba-da-daah" into the results vamp. */
const RESULTS_STING: Pattern = {
  bpm: 104,
  bars: 1,
  swing: 0,
  chordSteps: 2,
  chords: [BB_BRASS, C_BRASS, D_BRASS, D_BRASS, D_BRASS, D_BRASS, D_BRASS, D_BRASS],
  keys: 'brass',
  tracks: {
    keys: 'x.x.x-----------',
    bass: 'r.r.r-----------',
    kick: 'x.x.X...........',
    snare: '....X...........',
    crash: '....x...........',
  },
  mix: { keys: 0.55, bass: 0.6, kick: 0.8, snare: 0.5, crash: 0.5 },
};

/** D dorian, 104 bpm, lightly swung: funky i–IV vamp (Dm9 G13), clav and ghosted hats. */
const RESULTS: Pattern = {
  bpm: 104,
  bars: 4,
  swing: 0.12,
  chordSteps: 16,
  chords: [D_M9, G_13, D_M9, G_13],
  keys: 'clav',
  tracks: {
    kick: 'x..x....x.x.....',
    snare: '....x.......x..g',
    hat: 'xgxgxgxgxgxgxgxg',
    bass: 'r--r..o.r.f.r-a.',
    keys: '..x..x....x..x..',
  },
  mix: { kick: 0.8, snare: 0.4, hat: 0.28, bass: 0.7, keys: 0.45 },
};

/** Two bars of C major brass fanfare (C C C C F G | C) over a snare roll. */
const PODIUM_FANFARE: Pattern = {
  bpm: 116,
  bars: 2,
  swing: 0,
  chordSteps: 4,
  chords: [C_BRASS, C_BRASS, F_BRASS, G_BRASS, C_BRASS, C_BRASS, C_BRASS, C_BRASS],
  keys: 'brass',
  tracks: {
    keys: 'x.xxx---x---x---x---------------',
    bass: 'r.rrr---r---r---r---------------',
    kick: 'x.......x...x...X...............',
    snare: '........gggxxxXX................',
    crash: '................x...............',
  },
  lead: [
    [16, 72, 1],
    [17, 76, 1],
    [18, 79, 1],
    [19, 84, 8],
  ],
  mix: { keys: 0.55, bass: 0.6, kick: 0.8, snare: 0.5, crash: 0.5, lead: 0.4 },
};

/** C major, 116 bpm, settled two-feel: ii–V–I–VI (Dm9 G13 Cmaj9 A7♭9) with bell melody. */
const PODIUM: Pattern = {
  bpm: 116,
  bars: 8,
  swing: 0.1,
  chordSteps: 16,
  chords: [D_M9_LOW, G_13_LOW, C_MAJ9, A_7B9, D_M9_LOW, G_13_LOW, C_MAJ9, A_7B9],
  keys: 'epiano',
  tracks: {
    kick: 'x.......x.......',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    bass: 'r-------f-----a-',
    keys: 'x-----x---------',
  },
  lead: [
    [32, 76, 2],
    [34, 79, 2],
    [36, 81, 4],
    [40, 79, 2],
    [42, 76, 2],
    [44, 74, 4],
    [96, 84, 2],
    [98, 81, 2],
    [100, 79, 4],
    [104, 76, 2],
    [106, 74, 2],
    [108, 72, 4],
  ],
  mix: { kick: 0.65, snare: 0.3, hat: 0.25, bass: 0.65, keys: 0.5, lead: 0.4 },
};

export const SONGS = {
  lobby: { id: 'lobby', loop: LOBBY },
  roundIntro: { id: 'roundIntro', intro: ROUND_FILL, land: true, loop: WRITING },
  writing: { id: 'writing', loop: WRITING },
  voting: { id: 'voting', loop: VOTING },
  results: { id: 'results', intro: RESULTS_STING, loop: RESULTS },
  podium: { id: 'podium', intro: PODIUM_FANFARE, loop: PODIUM },
} satisfies Record<string, Song>;

const BY_PHASE: Record<RoomPhase, Song | null> = {
  LOBBY: SONGS.lobby,
  ROUND_INTRO: SONGS.roundIntro,
  WRITING: SONGS.writing,
  FINAL_WRITING: SONGS.writing,
  VOTING: SONGS.voting,
  FINAL_VOTING: SONGS.voting,
  MATCHUP_REVEAL: null,
  ROUND_RESULTS: SONGS.results,
  PODIUM: SONGS.podium,
};

/** `null` is the home screen, which shares the lobby groove. */
export function songFor(phase: RoomPhase | null): Song | null {
  return phase === null ? SONGS.lobby : BY_PHASE[phase];
}
