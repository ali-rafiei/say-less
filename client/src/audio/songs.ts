import type { RoomPhase } from '@say-less/shared';

export const STEPS_PER_BAR = 16;

/** MIDI numbers: `root` for the bass, `notes` the voiced upper structure. */
export interface Chord {
  root: number;
  notes: number[];
}

export type KeysVoice = 'epiano' | 'pad' | 'pluck' | 'clav' | 'brass';

/**
 * One character per 16th step; a track shorter than its section repeats through it.
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

interface Sound {
  bpm: number;
  /** Fraction of a 16th that off-beat 16ths are pushed late. */
  swing: number;
  keys: KeysVoice;
  mix: Partial<Record<MixChannel, number>>;
}

export interface Section {
  bars: number;
  chordSteps: number;
  chords: Chord[];
  tracks: Tracks;
  lead?: LeadNote[];
}

export interface Pattern extends Sound, Section {}

/** A loop written as named sections, played in `form` order. */
export interface Arrangement extends Sound {
  sections: Record<string, Section>;
  form: string[];
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
const A_M7: Chord = { root: 45, notes: [55, 60, 64, 67] };
const BB_MAJ9: Chord = { root: 46, notes: [57, 60, 62, 65] };
const G_M9: Chord = { root: 43, notes: [58, 62, 65, 69] };
const BB_M6: Chord = { root: 46, notes: [58, 61, 65, 67] };
const C_9: Chord = { root: 48, notes: [58, 62, 64, 67] };

const A_M9: Chord = { root: 45, notes: [60, 64, 67, 71] };
const F_MAJ9_HIGH: Chord = { root: 41, notes: [60, 64, 67, 69] };
const D_M9: Chord = { root: 38, notes: [60, 64, 65, 69] };
const E_7SUS: Chord = { root: 40, notes: [59, 62, 64, 69] };
const E_7: Chord = { root: 40, notes: [59, 62, 64, 68] };
const G_ADD9: Chord = { root: 43, notes: [59, 62, 67, 69] };
const E_M7: Chord = { root: 40, notes: [59, 62, 64, 67] };

const C_TRIAD: Chord = { root: 48, notes: [60, 64, 67] };
const A_MINOR: Chord = { root: 45, notes: [60, 64, 69] };
const D_M7_TRIAD: Chord = { root: 50, notes: [60, 65, 69] };
const G_7: Chord = { root: 43, notes: [59, 65, 67] };
const E_MINOR: Chord = { root: 40, notes: [59, 64, 67] };
const F_TRIAD: Chord = { root: 41, notes: [60, 65, 69] };
const G_TRIAD: Chord = { root: 43, notes: [59, 62, 67] };
const E_7_TRIAD: Chord = { root: 40, notes: [59, 62, 68] };

const G_13: Chord = { root: 43, notes: [59, 64, 65, 69] };
const A_7: Chord = { root: 45, notes: [61, 64, 67, 69] };
const BB_BRASS: Chord = { root: 46, notes: [58, 62, 65, 70] };
const C_BRASS: Chord = { root: 48, notes: [60, 64, 67, 72] };
const D_BRASS: Chord = { root: 50, notes: [62, 66, 69, 74] };
const F_BRASS: Chord = { root: 41, notes: [60, 65, 69, 72] };
const G_BRASS: Chord = { root: 43, notes: [59, 62, 67, 71] };

const D_M9_LOW: Chord = { root: 38, notes: [57, 60, 64, 65] };
const G_13_LOW: Chord = { root: 43, notes: [57, 59, 64, 65] };
const C_MAJ9: Chord = { root: 48, notes: [55, 59, 62, 64] };
const A_7B9: Chord = { root: 45, notes: [55, 58, 61, 64] };
const F_MAJ7: Chord = { root: 41, notes: [57, 60, 64, 65] };
const E_M7_LOW: Chord = { root: 40, notes: [55, 59, 62, 64] };

const LOBBY_CHORDS = [F_MAJ9, D_M7, BB_MAJ7, C_9SUS, F_MAJ9, D_M7, BB_MAJ7, C_9SUS];
const LOBBY_BRIDGE_CHORDS = [
  ...[BB_MAJ9, A_M7, G_M9, C_9SUS, BB_MAJ9, A_M7, D_M9_LOW].flatMap((chord) => [chord, chord]),
  G_M9,
  C_9,
];

/**
 * F major, 92 bpm, swung: I–vi–IV–V (Fmaj9 Dm7 B♭maj7 C9sus), pentatonic answer in bars 5–8,
 * then a B♭ bridge, a kickless breakdown and a turn through the borrowed B♭m6.
 */
const LOBBY: Arrangement = {
  bpm: 92,
  swing: 0.16,
  keys: 'epiano',
  mix: { kick: 0.8, snare: 0.35, hat: 0.3, riser: 0.25, bass: 0.7, keys: 0.5, lead: 0.4 },
  form: ['a', 'a2', 'bridge', 'a3', 'breakdown', 'bridge2', 'turn', 'out'],
  sections: {
    a: {
      bars: 8,
      chordSteps: 16,
      chords: LOBBY_CHORDS,
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
    },
    a2: {
      bars: 8,
      chordSteps: 16,
      chords: [F_MAJ9, D_M7, BB_MAJ7, C_9SUS, F_MAJ9, A_M7, BB_MAJ7, C_9SUS],
      tracks: {
        kick: 'X.....x...x.....',
        snare: '....x.......x...'.repeat(7) + '....x.....g.x.gg',
        hat: 'x.x.x.xgx.x.x.xg',
        bass:
          ('r-----r-o--.f-a.' + 'r-----o-r--.f-a.').repeat(3) +
          'r-----r-o--.f-a.' +
          'r--.f--.o--.f-a.',
        keys: 'x------x--------',
      },
      lead: [
        [8, 69, 2],
        [10, 72, 2],
        [12, 74, 6],
        [40, 77, 2],
        [42, 74, 2],
        [44, 72, 6],
        [72, 81, 2],
        [74, 79, 2],
        [76, 77, 4],
        [80, 74, 2],
        [82, 72, 6],
        [104, 74, 2],
        [106, 72, 2],
        [108, 69, 4],
        [114, 67, 2],
        [116, 65, 10],
      ],
    },
    bridge: {
      bars: 8,
      chordSteps: 8,
      chords: LOBBY_BRIDGE_CHORDS,
      tracks: {
        kick: 'X.......x.x.....',
        snare: '....x.......x..g'.repeat(7) + '....x...g.g.x.xx',
        hat: 'x.x.x.x.x.x.x.x.',
        bass:
          'r-------o-----a.'.repeat(3) +
          'r-----r-o--.f-a.' +
          'r-------o-----a.'.repeat(3) +
          'r--.f---r--.o-a.',
        keys: 'x-------g-------',
      },
      lead: [
        [4, 74, 2],
        [6, 72, 2],
        [8, 69, 6],
        [20, 72, 2],
        [22, 69, 2],
        [24, 67, 6],
        [56, 70, 2],
        [58, 69, 2],
        [60, 67, 4],
        [68, 77, 2],
        [70, 74, 2],
        [72, 72, 6],
        [84, 76, 2],
        [86, 72, 2],
        [88, 69, 6],
        [116, 70, 2],
        [118, 72, 2],
        [120, 74, 2],
        [122, 76, 4],
      ],
    },
    a3: {
      bars: 8,
      chordSteps: 16,
      chords: LOBBY_CHORDS,
      tracks: {
        kick: 'X.....x...x.....',
        snare: '....x.......x...',
        hat: 'x.x.x.xgx.x.x.o.',
        bass: 'r-----r-o--.f-a.',
        keys: 'x------x--------',
      },
      lead: [
        [8, 76, 4],
        [24, 77, 4],
        [40, 74, 4],
        [56, 72, 6],
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
    },
    breakdown: {
      bars: 8,
      chordSteps: 16,
      chords: [D_M9_LOW, BB_MAJ9, F_MAJ9, C_9SUS, D_M9_LOW, BB_MAJ9, G_M9, C_9SUS],
      tracks: {
        snare: '....g.......g...'.repeat(7) + 'g...g...g.g.gxxX',
        hat: 'x...x.g.x...x.g.',
        riser: '.'.repeat(112) + 'x---------------',
        bass: 'r---------------'.repeat(6) + 'r-------r-------' + 'r-----r-o--.f-a.',
        keys: 'x-------x-------',
      },
      lead: [
        [8, 72, 8],
        [40, 76, 8],
        [72, 74, 8],
        [104, 70, 8],
      ],
    },
    bridge2: {
      bars: 8,
      chordSteps: 8,
      chords: LOBBY_BRIDGE_CHORDS,
      tracks: {
        kick: 'X.......x.x.....',
        snare: '....x.......x..g'.repeat(7) + '....x...g.g.x.xx',
        hat: 'x.o.x.xgx.o.x.xg',
        bass:
          'r-------o-----a.'.repeat(3) +
          'r-----r-o--.f-a.' +
          'r-------o-----a.'.repeat(3) +
          'r--.f---r--.o-a.',
        keys: 'x-------g-------',
      },
      lead: [
        [4, 77, 2],
        [6, 74, 2],
        [8, 72, 6],
        [20, 76, 2],
        [22, 72, 2],
        [24, 69, 6],
        [52, 74, 2],
        [54, 72, 2],
        [56, 70, 6],
        [68, 81, 2],
        [70, 77, 2],
        [72, 74, 6],
        [84, 79, 2],
        [86, 76, 2],
        [88, 72, 6],
        [116, 74, 2],
        [118, 70, 2],
        [120, 72, 2],
        [122, 67, 4],
      ],
    },
    turn: {
      bars: 8,
      chordSteps: 16,
      chords: [F_MAJ9, A_M7, BB_MAJ7, BB_M6, A_M7, D_M7, G_M9, C_9SUS],
      tracks: {
        kick: 'X.....x...x.....',
        snare: '....x.......x...',
        hat: 'x.x.x.xgx.x.x.xg',
        bass:
          'r-----r-o--.f-a.'.repeat(3) +
          'r-----o-r-----a.' +
          'r-----r-o--.f-a.'.repeat(3) +
          'r--.f--.o--.f-a.',
        keys: 'x------x--------',
      },
      lead: [
        [2, 69, 2],
        [4, 72, 2],
        [6, 76, 6],
        [24, 74, 2],
        [26, 72, 6],
        [52, 70, 4],
        [56, 73, 6],
        [64, 72, 6],
        [72, 69, 2],
        [74, 67, 4],
        [100, 70, 2],
        [102, 74, 2],
        [104, 77, 6],
        [116, 74, 2],
        [118, 72, 6],
      ],
    },
    out: {
      bars: 8,
      chordSteps: 16,
      chords: [F_MAJ9, D_M7, BB_MAJ7, C_9SUS, F_MAJ9, D_M7, G_M9, C_9SUS],
      tracks: {
        kick: 'X.....x...x.....',
        snare: '....x.......x...'.repeat(7) + '....x.....g.x.gX',
        hat: 'x.x.o.xgx.x.o.xg',
        bass: 'r-----r-o--.f-a.'.repeat(7) + 'r--.f--.o--.f-a.',
        keys: 'x------x--------',
      },
      lead: [
        [8, 72, 2],
        [10, 74, 2],
        [12, 77, 4],
        [16, 74, 2],
        [18, 72, 2],
        [20, 69, 8],
        [40, 69, 2],
        [42, 72, 2],
        [44, 74, 4],
        [48, 72, 2],
        [50, 69, 2],
        [52, 67, 10],
        [72, 81, 2],
        [74, 79, 2],
        [76, 77, 4],
        [80, 74, 2],
        [82, 72, 6],
        [104, 74, 2],
        [106, 70, 2],
        [108, 69, 4],
        [114, 67, 2],
        [116, 65, 10],
      ],
    },
  },
};

/**
 * A minor, 96 bpm: i–VI–iv–V (Am9 Fmaj9 Dm9 E7sus4) pads over a clock tick-tock, a C major
 * middle (F G Em Am) and a still passage where the clock stops for four bars.
 */
const WRITING: Arrangement = {
  bpm: 96,
  swing: 0,
  keys: 'pad',
  mix: { tick: 0.5, kick: 0.5, bass: 0.45, keys: 0.5, lead: 0.25 },
  form: ['a', 'a2', 'b', 'still', 'a3'],
  sections: {
    a: {
      bars: 8,
      chordSteps: 16,
      chords: [A_M9, F_MAJ9_HIGH, D_M9, E_7SUS, A_M9, F_MAJ9_HIGH, D_M9, E_7SUS],
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
    },
    a2: {
      bars: 8,
      chordSteps: 16,
      chords: [A_M9, F_MAJ9_HIGH, D_M9, E_7SUS, A_M9, F_MAJ9_HIGH, D_M9, E_7],
      tracks: {
        tick: 'X...x...X...x...',
        kick: 'x...............'.repeat(7) + 'x.......x.......',
        bass:
          'r.r.r.r.r.r.r.r.'.repeat(3) +
          'r.r.r.r.o.r.f.r.' +
          'r.r.r.r.r.r.r.r.'.repeat(3) +
          'r.r.r.r.o.r.r.a.',
        keys: 'x---------------',
      },
      lead: [
        [40, 72, 4],
        [44, 74, 12],
        [72, 76, 4],
        [76, 74, 4],
        [80, 72, 8],
        [88, 69, 8],
        [96, 74, 12],
      ],
    },
    b: {
      bars: 8,
      chordSteps: 16,
      chords: [F_MAJ9_HIGH, G_ADD9, E_M7, A_M9, F_MAJ9_HIGH, G_ADD9, E_7SUS, E_7],
      tracks: {
        tick: 'X...x...X...x...',
        kick: 'x.......x.......',
        bass: 'r.r.r.r.r.r.o.r.'.repeat(7) + 'r.r.r.r.r.o.r.a.',
        keys: 'x---------------',
      },
      lead: [
        [8, 76, 2],
        [10, 74, 2],
        [12, 72, 8],
        [24, 71, 4],
        [28, 74, 4],
        [56, 69, 8],
        [72, 77, 2],
        [74, 76, 2],
        [76, 72, 8],
        [88, 74, 8],
        [116, 71, 4],
        [120, 68, 4],
      ],
    },
    still: {
      bars: 8,
      chordSteps: 16,
      chords: [D_M9, A_M9, F_MAJ9_HIGH, E_7SUS, D_M9, A_M9, F_MAJ9_HIGH, E_7],
      tracks: {
        tick: '.'.repeat(64) + 'X...x...X...x...'.repeat(4),
        bass: 'r-------r-------'.repeat(4) + 'r.r.r.r.r.r.r.r.'.repeat(3) + 'r.r.r.r.r.r.r.a.',
        keys: 'x---------------',
      },
      lead: [
        [24, 76, 8],
        [56, 74, 8],
        [88, 72, 8],
        [116, 71, 8],
      ],
    },
    a3: {
      bars: 8,
      chordSteps: 16,
      chords: [A_M9, F_MAJ9_HIGH, D_M9, E_7SUS, A_M9, F_MAJ9_HIGH, D_M9, E_7],
      tracks: {
        tick: 'X...x...X...x...',
        kick: 'x...............'.repeat(7) + 'x.......x...x...',
        bass: 'r.r.r.r.r.r.r.r.'.repeat(7) + 'r.r.r.r.o.r.r.a.',
        keys: 'x---------------',
      },
      lead: [
        [72, 76, 4],
        [76, 79, 4],
        [80, 76, 8],
        [88, 74, 8],
        [96, 72, 12],
        [114, 76, 2],
        [116, 74, 2],
        [118, 71, 6],
      ],
    },
  },
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

const VOTING_CHORDS = [C_TRIAD, A_MINOR, D_M7_TRIAD, G_7, C_TRIAD, A_MINOR, D_M7_TRIAD, G_7];

/**
 * C major, 124 bpm: I–vi–ii–V (C Am Dm7 G7), octave bass, off-beat stabs, pentatonic hook,
 * a half-time bridge (F G Em Am) and a kickless drop with a riser into the last chorus.
 */
const VOTING: Arrangement = {
  bpm: 124,
  swing: 0,
  keys: 'pluck',
  mix: {
    kick: 0.8,
    snare: 0.45,
    hat: 0.3,
    crash: 0.35,
    riser: 0.35,
    bass: 0.65,
    keys: 0.5,
    lead: 0.4,
  },
  form: ['a', 'a2', 'bridge', 'drop', 'out'],
  sections: {
    a: {
      bars: 8,
      chordSteps: 16,
      chords: VOTING_CHORDS,
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
    },
    a2: {
      bars: 8,
      chordSteps: 16,
      chords: [C_TRIAD, E_MINOR, F_TRIAD, G_7, C_TRIAD, A_MINOR, D_M7_TRIAD, G_7],
      tracks: {
        kick: 'X...x...X...x...',
        snare: '....x.......x...'.repeat(7) + '....x.....x.x.xX',
        hat: 'x.o.x.o.x.o.x.o.',
        bass:
          'r.o.r.o.r.o.f.a.'.repeat(3) +
          'r.o.r.o.f.o.r.a.' +
          'r.o.r.o.r.o.f.a.'.repeat(3) +
          'r.r.f.f.o.o.f.a.',
        keys: '..x...x...x...x.',
      },
      lead: [
        [24, 76, 2],
        [26, 79, 2],
        [28, 76, 4],
        [56, 74, 2],
        [58, 71, 2],
        [60, 67, 4],
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
        [100, 77, 2],
        [102, 76, 2],
        [104, 74, 6],
        [112, 71, 2],
        [114, 74, 2],
        [116, 77, 4],
        [120, 79, 6],
      ],
    },
    bridge: {
      bars: 8,
      chordSteps: 16,
      chords: [F_TRIAD, G_TRIAD, E_MINOR, A_MINOR, F_TRIAD, G_TRIAD, D_M7_TRIAD, E_7_TRIAD],
      tracks: {
        kick: 'X.......x.......',
        snare: '........x.......'.repeat(7) + '....x...x.x.xxXX',
        hat: 'x.x.x.x.x.x.x.x.',
        bass: 'r---o---r---f-a.'.repeat(7) + 'r.r.o.o.r.r.f.a.',
        keys: '..x...g...x...g.',
      },
      lead: [
        [0, 72, 2],
        [2, 74, 2],
        [4, 77, 4],
        [24, 74, 2],
        [26, 71, 6],
        [52, 72, 2],
        [54, 76, 2],
        [56, 81, 6],
        [68, 77, 2],
        [70, 76, 2],
        [72, 72, 4],
        [84, 74, 2],
        [86, 79, 6],
        [116, 71, 2],
        [118, 68, 2],
        [120, 64, 6],
      ],
    },
    drop: {
      bars: 4,
      chordSteps: 16,
      chords: [A_MINOR, F_TRIAD, D_M7_TRIAD, G_7],
      tracks: {
        snare: '.'.repeat(48) + 'g.g.g.g.x.x.xxXX',
        hat: 'x.o.x.o.x.o.x.o.',
        riser: '.'.repeat(32) + 'x-------------------------------',
        bass: 'r.o.r.o.r.o.r.o.'.repeat(3) + 'r.r.r.r.r.r.r.a.',
        keys: '..x...x...x...x.',
      },
      lead: [
        [8, 76, 4],
        [24, 77, 4],
        [40, 74, 4],
      ],
    },
    out: {
      bars: 8,
      chordSteps: 16,
      chords: VOTING_CHORDS,
      tracks: {
        kick: 'X...x...X...x...',
        snare: '....x.......x...'.repeat(7) + '....x.....x.x.xX',
        hat: 'x.o.x.o.x.o.x.o.',
        crash: 'x' + '.'.repeat(127),
        bass: 'r.o.r.o.r.o.f.a.'.repeat(7) + 'r.r.f.f.o.o.f.a.',
        keys: 'x.x...x...x...x.',
      },
      lead: [
        [0, 67, 2],
        [2, 69, 2],
        [4, 72, 2],
        [6, 76, 4],
        [10, 74, 2],
        [12, 72, 4],
        [16, 69, 2],
        [18, 72, 2],
        [20, 76, 2],
        [22, 79, 6],
        [32, 81, 2],
        [34, 79, 2],
        [36, 76, 2],
        [38, 74, 2],
        [40, 72, 2],
        [42, 69, 6],
        [48, 67, 2],
        [50, 69, 2],
        [52, 74, 4],
        [56, 76, 2],
        [58, 74, 6],
        [68, 79, 2],
        [70, 76, 2],
        [72, 72, 4],
        [84, 72, 2],
        [86, 76, 2],
        [88, 81, 4],
        [96, 81, 2],
        [98, 79, 2],
        [100, 77, 2],
        [102, 76, 2],
        [104, 74, 6],
        [112, 71, 2],
        [114, 74, 2],
        [116, 77, 4],
        [120, 79, 6],
      ],
    },
  },
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

/**
 * D dorian, 104 bpm, lightly swung: funky i–IV vamp (Dm9 G13), clav and ghosted hats, an
 * Em7–A7 turnaround and a lift through Fmaj7 with a bell riff.
 */
const RESULTS: Arrangement = {
  bpm: 104,
  swing: 0.12,
  keys: 'clav',
  mix: { kick: 0.8, snare: 0.4, hat: 0.28, bass: 0.7, keys: 0.45, lead: 0.3 },
  form: ['a', 'a2', 'lift', 'a3'],
  sections: {
    a: {
      bars: 4,
      chordSteps: 16,
      chords: [D_M9, G_13, D_M9, G_13],
      tracks: {
        kick: 'x..x....x.x.....',
        snare: '....x.......x..g',
        hat: 'xgxgxgxgxgxgxgxg',
        bass: 'r--r..o.r.f.r-a.',
        keys: '..x..x....x..x..',
      },
    },
    a2: {
      bars: 4,
      chordSteps: 8,
      chords: [D_M9, D_M9, G_13, G_13, D_M9, D_M9, E_M7, A_7],
      tracks: {
        kick: 'x..x....x.x.....',
        snare: '....x.......x..g'.repeat(3) + '....x.....g.x.xg',
        hat: 'xgxgxgxgxgxgxgxg'.repeat(3) + 'xgxgxgxgxgxgxgog',
        bass: 'r--r..o.r.f.r-a.'.repeat(3) + 'r--.o-..r--.f-a.',
        keys: '..x..x....x..x..',
      },
    },
    lift: {
      bars: 4,
      chordSteps: 16,
      chords: [F_MAJ7, G_13, E_M7, A_7],
      tracks: {
        kick: 'x.......x.x.....',
        snare: '....x.......x...',
        hat: 'x.xgx.xgx.xgx.og',
        bass: 'r--r..o.r--.o-a.',
        keys: '..x..x..x...x...',
      },
      lead: [
        [8, 72, 2],
        [10, 69, 2],
        [12, 76, 4],
        [28, 74, 2],
        [30, 71, 6],
        [40, 79, 2],
        [42, 76, 6],
        [56, 73, 4],
        [60, 69, 4],
      ],
    },
    a3: {
      bars: 4,
      chordSteps: 16,
      chords: [D_M9, G_13, D_M9, G_13],
      tracks: {
        kick: 'x..x....x.x.....',
        snare: '....x.......x..g'.repeat(3) + '....x...g.g.x.xX',
        hat: 'xgxgxgxoxgxgxgxo',
        bass: 'r--r..o.r.f.r-a.'.repeat(3) + 'r--r..o.r.o.f-a.',
        keys: '..x..x....x..x..'.repeat(3) + '..x..x..x.x.x...',
      },
    },
  },
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

const PODIUM_CHORDS = [D_M9_LOW, G_13_LOW, C_MAJ9, A_7B9, D_M9_LOW, G_13_LOW, C_MAJ9, A_7B9];

/**
 * C major, 116 bpm, settled two-feel: ii–V–I–VI (Dm9 G13 Cmaj9 A7♭9) with bell melody, and a
 * bridge down from Fmaj7 that holds the kick back for four bars.
 */
const PODIUM: Arrangement = {
  bpm: 116,
  swing: 0.1,
  keys: 'epiano',
  mix: { kick: 0.65, snare: 0.3, hat: 0.25, bass: 0.65, keys: 0.5, lead: 0.4 },
  form: ['a', 'a2', 'bridge', 'a3'],
  sections: {
    a: {
      bars: 8,
      chordSteps: 16,
      chords: PODIUM_CHORDS,
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
    },
    a2: {
      bars: 8,
      chordSteps: 16,
      chords: PODIUM_CHORDS,
      tracks: {
        kick: 'x.......x.......',
        snare: '....x.......x...'.repeat(7) + '....x.....g.x.gg',
        hat: 'x.x.x.x.x.x.x.x.',
        bass: ('r-------f-----a-' + 'r-----o-f-----a-').repeat(4),
        keys: 'x-----x---------',
      },
      lead: [
        [4, 72, 2],
        [6, 74, 2],
        [8, 77, 6],
        [36, 79, 2],
        [38, 81, 2],
        [40, 83, 6],
        [52, 82, 2],
        [54, 81, 6],
        [68, 77, 2],
        [70, 76, 2],
        [72, 74, 6],
        [96, 84, 2],
        [98, 83, 2],
        [100, 79, 4],
        [104, 76, 2],
        [106, 74, 2],
        [108, 72, 4],
        [116, 76, 2],
        [118, 73, 6],
      ],
    },
    bridge: {
      bars: 8,
      chordSteps: 8,
      chords: [
        ...[F_MAJ7, E_M7_LOW, D_M9_LOW, C_MAJ9, F_MAJ7, E_M7_LOW].flatMap((chord) => [
          chord,
          chord,
        ]),
        D_M9_LOW,
        G_13_LOW,
        A_7B9,
        A_7B9,
      ],
      tracks: {
        kick: '.'.repeat(64) + 'x.......x.......'.repeat(4),
        snare: '....g.......g...'.repeat(4) + '....x.......x...'.repeat(3) + '....x...g.g.x.xx',
        hat: 'x.x.x.x.x.x.x.x.',
        bass: 'r-------f-----a-'.repeat(6) + 'r-------r-----a-' + 'r---o---f-----a-',
        keys: 'x-------x-------',
      },
      lead: [
        [8, 81, 4],
        [24, 79, 4],
        [40, 77, 4],
        [56, 76, 6],
        [68, 72, 2],
        [70, 76, 2],
        [72, 81, 6],
        [84, 79, 2],
        [86, 74, 6],
        [100, 77, 2],
        [104, 76, 4],
        [116, 76, 2],
        [118, 73, 6],
      ],
    },
    a3: {
      bars: 8,
      chordSteps: 16,
      chords: PODIUM_CHORDS,
      tracks: {
        kick: 'x.......x.......',
        snare: '....x.......x...'.repeat(7) + '....x...g...x.gg',
        hat: 'x.x.x.o.x.x.x.o.',
        bass: 'r-------f-----a-'.repeat(7) + 'r---o---f---r-a-',
        keys: 'x-----x---------',
      },
      lead: [
        [8, 69, 2],
        [10, 72, 2],
        [12, 74, 4],
        [32, 76, 2],
        [34, 79, 2],
        [36, 81, 4],
        [40, 79, 2],
        [42, 76, 2],
        [44, 74, 4],
        [72, 74, 2],
        [74, 77, 2],
        [76, 81, 4],
        [96, 84, 2],
        [98, 81, 2],
        [100, 79, 4],
        [104, 76, 2],
        [106, 74, 2],
        [108, 72, 4],
        [118, 73, 6],
      ],
    },
  },
};

export const ARRANGEMENTS = {
  lobby: LOBBY,
  writing: WRITING,
  voting: VOTING,
  results: RESULTS,
  podium: PODIUM,
};

const WRITING_LOOP = arrange(WRITING);

export const SONGS = {
  lobby: { id: 'lobby', loop: arrange(LOBBY) },
  roundIntro: { id: 'roundIntro', intro: ROUND_FILL, land: true, loop: WRITING_LOOP },
  writing: { id: 'writing', loop: WRITING_LOOP },
  voting: { id: 'voting', loop: arrange(VOTING) },
  results: { id: 'results', intro: RESULTS_STING, loop: arrange(RESULTS) },
  podium: { id: 'podium', intro: PODIUM_FANFARE, loop: arrange(PODIUM) },
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

/** Lays the arrangement's sections end to end as one pattern for the sequencer. */
function arrange(arrangement: Arrangement): Pattern {
  const { sections, form, ...sound } = arrangement;
  const parts = form.map((name) => sections[name]!);
  const chordSteps = Math.min(...parts.map((part) => part.chordSteps));
  const channels = new Set(parts.flatMap((part) => Object.keys(part.tracks) as (keyof Tracks)[]));
  const tracks: Tracks = {};
  for (const channel of channels) {
    tracks[channel] = parts
      .map((part) => spread(part.tracks[channel], part.bars * STEPS_PER_BAR))
      .join('');
  }
  const lead: LeadNote[] = [];
  let offset = 0;
  for (const part of parts) {
    for (const [step, midi, length] of part.lead ?? []) lead.push([offset + step, midi, length]);
    offset += part.bars * STEPS_PER_BAR;
  }
  const chords = parts.flatMap((part) =>
    part.chords.flatMap((chord) => Array<Chord>(part.chordSteps / chordSteps).fill(chord)),
  );
  return { ...sound, bars: offset / STEPS_PER_BAR, chordSteps, chords, tracks, lead };
}

/** A section-long copy of `track`, or silence when the section leaves the channel out. */
function spread(track: string | undefined, steps: number): string {
  return track ? track.repeat(steps / track.length) : '.'.repeat(steps);
}
