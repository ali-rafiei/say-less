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

/** A falling whoosh, a boomy thud with a touch of feedback ring, then a smaller bounce. */
export const micDrop: Effect = (g, t) => {
  noise(g, g.fx, t, {
    gain: 0.18,
    duration: 0.22,
    env: { attack: 0.15, decay: 0, sustain: 1, release: 0.03 },
    filter: { type: 'bandpass', freq: 2500, to: 350, time: 0.22, q: 1.2 },
  });
  const hitAt = t + 0.2;
  tone(g, g.fx, hitAt, {
    notes: [48],
    pitchFrom: 3,
    pitchTime: 0.1,
    gain: 0.6,
    duration: 0.4,
    env: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.05 },
    send: 0.25,
  });
  tone(g, g.fx, hitAt, {
    notes: [220],
    layers: [{ type: 'triangle' }],
    pitchFrom: 1,
    pitchTo: 0.4,
    pitchTime: 0.2,
    gain: 0.25,
    duration: 0.2,
    env: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.05 },
  });
  noise(g, g.fx, hitAt, {
    gain: 0.4,
    duration: 0.3,
    env: { attack: 0.001, decay: 0.3 },
    filter: { type: 'lowpass', freq: 900, to: 200, time: 0.3 },
    send: 0.3,
  });
  tone(g, g.fx, hitAt + 0.04, {
    notes: [2093],
    gain: 0.02,
    duration: 0.25,
    env: { attack: 0.05, decay: 0.1, sustain: 1, release: 0.2 },
    send: 0.3,
  });
  const bounceAt = t + 0.52;
  tone(g, g.fx, bounceAt, {
    notes: [60],
    pitchFrom: 2.5,
    pitchTime: 0.08,
    gain: 0.3,
    duration: 0.2,
    env: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.05 },
  });
  return noise(g, g.fx, bounceAt, {
    gain: 0.2,
    duration: 0.12,
    env: { attack: 0.001, decay: 0.12 },
    filter: { type: 'lowpass', freq: 700 },
    send: 0.2,
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

/** Muted-brass "wah-wah" down a semitone at a time, the last note sagging. */
export const lose: Effect = (g, t) => {
  let end = t;
  [62, 61, 60].forEach((midi, i) => {
    const last = i === 2;
    end = tone(g, g.fx, t + i * 0.22, {
      notes: [midiToHz(midi)],
      layers: [
        { type: 'sawtooth', gain: 0.5 },
        { type: 'sawtooth', gain: 0.5, detune: 10 },
      ],
      ...(last ? { pitchFrom: 1, pitchTo: 0.94, pitchTime: 0.4 } : {}),
      filter: { type: 'lowpass', freq: 500, to: 1500, time: 0.08, q: 3 },
      gain: 0.12,
      duration: last ? 0.4 : 0.17,
      env: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.08 },
      send: 0.15,
    });
  });
  return end;
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
