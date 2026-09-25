import type { AudioGraph, Output } from './graph.ts';
import type { KeysVoice } from './songs.ts';
import { midiToHz, noise, tone, type ToneOptions } from './synth.ts';

type KeysPreset = Omit<ToneOptions, 'notes' | 'gain' | 'duration'>;

const KEYS: Record<KeysVoice, KeysPreset> = {
  epiano: {
    layers: [{ type: 'sine' }, { type: 'sine', ratio: 2, gain: 0.15 }],
    filter: { type: 'lowpass', freq: 2200 },
    env: { attack: 0.008, decay: 1.2, sustain: 0.35, release: 0.35 },
    send: 0.3,
  },
  pad: {
    layers: [
      { type: 'sawtooth', gain: 0.5, detune: -7 },
      { type: 'sawtooth', gain: 0.5, detune: 7 },
    ],
    filter: { type: 'lowpass', freq: 900, q: 0.5 },
    env: { attack: 0.6, decay: 0.8, sustain: 0.8, release: 0.9 },
    send: 0.45,
  },
  pluck: {
    layers: [
      { type: 'square', gain: 0.35 },
      { type: 'triangle', gain: 0.65 },
    ],
    filter: { type: 'lowpass', freq: 3500, to: 900, time: 0.12 },
    env: { attack: 0.003, decay: 0.15, sustain: 0.2, release: 0.08 },
    send: 0.15,
  },
  clav: {
    layers: [{ type: 'square' }],
    filter: { type: 'bandpass', freq: 1400, q: 1.5 },
    env: { attack: 0.002, decay: 0.12, sustain: 0.15, release: 0.05 },
    send: 0.1,
  },
  brass: {
    layers: [
      { type: 'sawtooth', gain: 0.5, detune: -6 },
      { type: 'sawtooth', gain: 0.5, detune: 6 },
    ],
    filter: { type: 'lowpass', freq: 500, to: 2800, time: 0.08 },
    env: { attack: 0.03, decay: 0.25, sustain: 0.7, release: 0.15 },
    send: 0.25,
  },
};

export function kick(graph: AudioGraph, out: Output, t: number, velocity: number): void {
  tone(graph, out, t, {
    notes: [52],
    pitchFrom: 3.4,
    pitchTime: 0.09,
    gain: 0.55 * velocity,
    duration: 0.3,
    env: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.05 },
  });
  noise(graph, out, t, {
    gain: 0.2 * velocity,
    duration: 0.012,
    env: { attack: 0.001, decay: 0.012 },
    filter: { type: 'lowpass', freq: 3500 },
  });
}

export function snare(graph: AudioGraph, out: Output, t: number, velocity: number): void {
  noise(graph, out, t, {
    gain: 0.45 * velocity,
    duration: 0.16,
    env: { attack: 0.001, decay: 0.16 },
    filter: { type: 'highpass', freq: 1800 },
    send: 0.15,
  });
  tone(graph, out, t, {
    notes: [185],
    layers: [{ type: 'triangle' }],
    pitchFrom: 1.4,
    pitchTime: 0.05,
    gain: 0.35 * velocity,
    duration: 0.08,
    env: { attack: 0.001, decay: 0.08, sustain: 0 },
  });
}

export function hat(
  graph: AudioGraph,
  out: Output,
  t: number,
  velocity: number,
  open: boolean,
): void {
  const length = open ? 0.22 : 0.035;
  noise(graph, out, t, {
    gain: 0.3 * velocity,
    duration: length,
    env: { attack: 0.001, decay: length },
    filter: { type: 'highpass', freq: 7000 },
    send: 0.05,
  });
}

export function crash(graph: AudioGraph, out: Output, t: number, velocity: number): void {
  noise(graph, out, t, {
    gain: 0.35 * velocity,
    duration: 1.4,
    env: { attack: 0.002, decay: 1.4, release: 0.2 },
    filter: { type: 'highpass', freq: 4500 },
    send: 0.4,
  });
}

/** Woodblock clock: `accent` is the higher "tick", otherwise the "tock". */
export function tick(
  graph: AudioGraph,
  out: Output,
  t: number,
  velocity: number,
  accent: boolean,
): void {
  tone(graph, out, t, {
    notes: [accent ? 1900 : 1400],
    layers: [{ type: 'sine' }, { type: 'sine', ratio: 2.7, gain: 0.3 }],
    gain: 0.35 * velocity,
    duration: 0.03,
    env: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
  });
  noise(graph, out, t, {
    gain: 0.12 * velocity,
    duration: 0.012,
    env: { attack: 0.001, decay: 0.012 },
    filter: { type: 'bandpass', freq: 4000, q: 3 },
  });
}

export function riser(
  graph: AudioGraph,
  out: Output,
  t: number,
  velocity: number,
  length: number,
): void {
  noise(graph, out, t, {
    gain: 0.5 * velocity,
    duration: length,
    env: { attack: length * 0.95, decay: 0, sustain: 1, release: 0.03 },
    filter: { type: 'bandpass', freq: 300, to: 6000, time: length, q: 2 },
    send: 0.3,
  });
}

export function bass(
  graph: AudioGraph,
  out: Output,
  t: number,
  velocity: number,
  midi: number,
  length: number,
): void {
  tone(graph, out, t, {
    notes: [midiToHz(midi)],
    layers: [
      { type: 'sawtooth', gain: 0.5 },
      { type: 'triangle', gain: 0.8 },
    ],
    filter: { type: 'lowpass', freq: 1400, to: 500, time: 0.15, q: 2 },
    gain: 0.36 * velocity,
    duration: length * 0.9,
    env: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.05 },
  });
}

export function keys(
  graph: AudioGraph,
  out: Output,
  t: number,
  velocity: number,
  voice: KeysVoice,
  notes: number[],
  length: number,
): void {
  tone(graph, out, t, {
    ...KEYS[voice],
    notes: notes.map(midiToHz),
    gain: (0.4 * velocity) / Math.sqrt(notes.length),
    duration: length,
  });
}

export function bell(
  graph: AudioGraph,
  out: Output,
  t: number,
  velocity: number,
  midi: number,
  length: number,
): void {
  tone(graph, out, t, {
    notes: [midiToHz(midi)],
    layers: [
      { type: 'sine' },
      { type: 'sine', ratio: 2, gain: 0.2 },
      { type: 'sine', ratio: 3, gain: 0.08 },
    ],
    gain: 0.3 * velocity,
    duration: length,
    env: { attack: 0.006, decay: 0.5, sustain: 0.3, release: 0.3 },
    send: 0.35,
  });
}
