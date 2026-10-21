import type { AudioGraph } from './graph.ts';
import { midiToHz, noise, tone } from './synth.ts';

/** Schedules a sound at `t` on the graph's effects bus and returns when it ends. */
export type Effect = (graph: AudioGraph, t: number) => number;

const BELL = [
  { type: 'triangle' as const },
  { type: 'sine' as const, ratio: 2, gain: 0.3 },
  { type: 'sine' as const, ratio: 3, gain: 0.1 },
];

export const tap: Effect = (g, t) => {
  noise(g, g.fx, t, {
    gain: 0.05,
    duration: 0.008,
    env: { attack: 0.001, decay: 0.008 },
    filter: { type: 'bandpass', freq: 5000, q: 2 },
  });
  return tone(g, g.fx, t, {
    notes: [880],
    layers: [{ type: 'sine' }, { type: 'triangle', ratio: 2, gain: 0.2 }],
    pitchFrom: 0.75,
    pitchTime: 0.03,
    gain: 0.22,
    duration: 0.06,
    env: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.03 },
  });
};

export const typewriter: Effect = (g, t) => {
  noise(g, g.fx, t, {
    gain: 0.35,
    duration: 0.02,
    env: { attack: 0.001, decay: 0.02 },
    filter: { type: 'bandpass', freq: 2800 + Math.random() * 1400, q: 2.5 },
  });
  return tone(g, g.fx, t, {
    notes: [150 + Math.random() * 40],
    pitchFrom: 1.6,
    pitchTime: 0.02,
    gain: 0.2,
    duration: 0.03,
    env: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
  });
};

/** A flame whoosh with crackles under a sliding, filtered sting. */
export const roast: Effect = (g, t) => {
  noise(g, g.fx, t, {
    gain: 0.28,
    duration: 0.45,
    env: { attack: 0.08, decay: 0.2, sustain: 0.8, release: 0.2 },
    filter: { type: 'bandpass', freq: 800, to: 3000, time: 0.35, q: 0.8 },
    send: 0.2,
  });
  for (let i = 0; i < 6; i++) {
    noise(g, g.fx, t + Math.random() * 0.5, {
      gain: 0.15,
      duration: 0.006,
      env: { attack: 0.001, decay: 0.006 },
      filter: { type: 'highpass', freq: 3000 },
    });
  }
  return tone(g, g.fx, t, {
    notes: [880, 1320],
    layers: [
      { type: 'sawtooth', gain: 0.5 },
      { type: 'square', gain: 0.3, detune: 8 },
    ],
    pitchFrom: 1,
    pitchTo: 0.25,
    pitchTime: 0.5,
    filter: { type: 'lowpass', freq: 4000, to: 600, time: 0.5, q: 4 },
    gain: 0.12,
    duration: 0.45,
    env: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.1 },
    send: 0.2,
  });
};

/** C–E–G–C bell arpeggio finishing on a shimmering chord. */
export const win: Effect = (g, t) => {
  [72, 76, 79, 84].forEach((midi, i) => {
    tone(g, g.fx, t + i * 0.09, {
      notes: [midiToHz(midi)],
      layers: BELL,
      gain: 0.2,
      duration: i === 3 ? 0.35 : 0.1,
      env: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.3 },
      send: 0.3,
    });
  });
  return tone(g, g.fx, t + 0.27, {
    notes: [84, 88, 91].map(midiToHz),
    gain: 0.05,
    duration: 0.3,
    env: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 },
    send: 0.5,
  });
};

/** A soft marimba "aww": two short notes stepping down, no buzz. */
export const lose: Effect = (g, t) => {
  let end = t;
  [64, 60].forEach((midi, i) => {
    end = tone(g, g.fx, t + i * 0.16, {
      notes: [midiToHz(midi)],
      layers: [{ type: 'sine' }, { type: 'sine', ratio: 4, gain: 0.12 }],
      gain: 0.16,
      duration: i === 1 ? 0.3 : 0.12,
      env: { attack: 0.004, decay: 0.25, sustain: 0, release: 0.15 },
      send: 0.15,
    });
  });
  return end;
};

/** A soft pop with a short bell on top; `step` raises the bell so a run of reveals climbs. */
export function reveal(step: number): Effect {
  return (g, t) => {
    tone(g, g.fx, t, {
      notes: [420],
      layers: [{ type: 'sine' }],
      pitchFrom: 0.55,
      pitchTime: 0.04,
      gain: 0.18,
      duration: 0.07,
      env: { attack: 0.002, decay: 0.07, sustain: 0, release: 0.03 },
    });
    // C major scale from G4, capped at two octaves so long walls stay pleasant.
    const scale = [67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84];
    const midi = scale[Math.min(Math.max(step, 0), scale.length - 1)]!;
    return tone(g, g.fx, t + 0.03, {
      notes: [midiToHz(midi)],
      layers: BELL,
      gain: 0.15,
      duration: 0.1,
      env: { attack: 0.004, decay: 0.2, sustain: 0.2, release: 0.25 },
      send: 0.25,
    });
  };
}

/** The final winner: a quick rising bell triad that opens into a bright held chord. */
export const fanfare: Effect = (g, t) => {
  [72, 76, 79].forEach((midi, i) => {
    tone(g, g.fx, t + i * 0.07, {
      notes: [midiToHz(midi)],
      layers: BELL,
      gain: 0.14,
      duration: 0.1,
      env: { attack: 0.004, decay: 0.2, sustain: 0.3, release: 0.25 },
      send: 0.3,
    });
  });
  noise(g, g.fx, t + 0.21, {
    gain: 0.025,
    duration: 0.5,
    env: { attack: 0.05, decay: 0.45 },
    filter: { type: 'highpass', freq: 7000 },
    send: 0.4,
  });
  return tone(g, g.fx, t + 0.21, {
    notes: [72, 76, 79, 84].map(midiToHz),
    layers: [{ type: 'triangle' }, { type: 'sine', ratio: 2, gain: 0.25 }],
    gain: 0.07,
    duration: 0.55,
    env: { attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.6 },
    send: 0.45,
  });
};

/** A thump, a bright burst and scattered inharmonic glass pings. */
export const shatter: Effect = (g, t) => {
  tone(g, g.fx, t, {
    notes: [90],
    pitchFrom: 2,
    pitchTime: 0.06,
    gain: 0.25,
    duration: 0.1,
    env: { attack: 0.001, decay: 0.1, sustain: 0 },
  });
  for (let i = 0; i < 7; i++) {
    tone(g, g.fx, t + i * 0.018 + Math.random() * 0.02, {
      notes: [2200 + Math.random() * 3300],
      layers: [{ type: 'sine' }, { type: 'sine', ratio: 2.76, gain: 0.4 }],
      gain: 0.07,
      duration: 0.15,
      env: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
      send: 0.4,
    });
  }
  return noise(g, g.fx, t, {
    gain: 0.28,
    duration: 0.25,
    env: { attack: 0.001, decay: 0.25, release: 0.05 },
    filter: { type: 'highpass', freq: 2500 },
    send: 0.3,
  });
};

export const tick: Effect = (g, t) => {
  noise(g, g.fx, t, {
    gain: 0.08,
    duration: 0.01,
    env: { attack: 0.001, decay: 0.01 },
    filter: { type: 'bandpass', freq: 3000, q: 4 },
  });
  return tone(g, g.fx, t, {
    notes: [1250],
    layers: [{ type: 'sine' }, { type: 'triangle', ratio: 2.1, gain: 0.2 }],
    gain: 0.22,
    duration: 0.05,
    env: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
  });
};

/** A soft descending "uh-uh". */
export const error: Effect = (g, t) => {
  const note = (freq: number, at: number, duration: number) =>
    tone(g, g.fx, at, {
      notes: [freq],
      layers: [{ type: 'triangle' }, { type: 'square', gain: 0.15 }],
      filter: { type: 'lowpass', freq: 1800 },
      gain: 0.16,
      duration,
      env: { attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.05 },
    });
  note(330, t, 0.09);
  return note(247, t + 0.11, 0.14);
};

/** Game-show "ding-ding" up to the tonic. */
export const votingChime: Effect = (g, t) => {
  let end = t;
  [784, 1046.5].forEach((freq, i) => {
    end = tone(g, g.fx, t + i * 0.12, {
      notes: [freq],
      layers: BELL,
      gain: 0.14,
      duration: 0.12,
      env: { attack: 0.004, decay: 0.3, sustain: 0.3, release: 0.35 },
      send: 0.3,
    });
  });
  return end;
};
