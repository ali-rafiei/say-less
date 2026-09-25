import type { AudioGraph, Output } from './graph.ts';

export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface Filter {
  type: BiquadFilterType;
  freq: number;
  q?: number;
  /** Sweep the cutoff to this frequency over `time` seconds. */
  to?: number;
  time?: number;
}

export interface Layer {
  type: OscillatorType;
  ratio?: number;
  gain?: number;
  detune?: number;
}

export interface ToneOptions {
  /** Frequencies in Hz; each gets every layer. */
  notes: number[];
  layers?: Layer[];
  gain: number;
  /** Gate length before the release starts. */
  duration: number;
  env?: Partial<Envelope>;
  /** Start at this multiple of each note and glide to `pitchTo` (default 1) over `pitchTime`. */
  pitchFrom?: number;
  pitchTo?: number;
  pitchTime?: number;
  filter?: Filter;
  send?: number;
}

export interface NoiseOptions {
  gain: number;
  duration: number;
  env?: Partial<Envelope>;
  filter: Filter;
  send?: number;
}

const DEFAULT_ENV: Envelope = { attack: 0.005, decay: 0.1, sustain: 1, release: 0.05 };
const SINE: Layer[] = [{ type: 'sine' }];

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Oscillator voice: layered oscillators per note into one filter and one ADSR amp. */
export function tone(graph: AudioGraph, out: Output, t: number, o: ToneOptions): number {
  const { ctx } = graph;
  const env = { ...DEFAULT_ENV, ...o.env };
  const end = t + o.duration + env.release;
  const amp = new GainNode(ctx, { gain: 0 });
  shape(amp.gain, t, o.gain, o.duration, env);
  const head = o.filter ? filterNode(ctx, t, o.filter) : amp;
  if (o.filter) head.connect(amp);
  const nodes: AudioNode[] = [amp, head, ...route(ctx, amp, out, o.send)];
  const sources: OscillatorNode[] = [];
  for (const note of o.notes) {
    for (const layer of o.layers ?? SINE) {
      const freq = note * (layer.ratio ?? 1);
      const osc = new OscillatorNode(ctx, {
        type: layer.type,
        frequency: freq,
        detune: layer.detune ?? 0,
      });
      if (o.pitchFrom !== undefined) {
        osc.frequency.setValueAtTime(freq * o.pitchFrom, t);
        osc.frequency.exponentialRampToValueAtTime(
          freq * (o.pitchTo ?? 1),
          t + (o.pitchTime ?? o.duration),
        );
      }
      const level = new GainNode(ctx, { gain: layer.gain ?? 1 });
      osc.connect(level).connect(head);
      osc.start(t);
      osc.stop(end);
      sources.push(osc);
      nodes.push(osc, level);
    }
  }
  releaseWhenDone(sources, nodes);
  return end;
}

/** Filtered noise burst read from the graph's shared noise buffer. */
export function noise(graph: AudioGraph, out: Output, t: number, o: NoiseOptions): number {
  const { ctx } = graph;
  const env = { ...DEFAULT_ENV, sustain: 0, ...o.env };
  const end = t + o.duration + env.release;
  const source = new AudioBufferSourceNode(ctx, { buffer: graph.noise, loop: true });
  const filter = filterNode(ctx, t, o.filter);
  const amp = new GainNode(ctx, { gain: 0 });
  shape(amp.gain, t, o.gain, o.duration, env);
  source.connect(filter).connect(amp);
  const nodes: AudioNode[] = [source, filter, amp, ...route(ctx, amp, out, o.send)];
  source.start(t, Math.random() * (graph.noise.duration - 0.5));
  source.stop(end);
  releaseWhenDone([source], nodes);
  return end;
}

/** Linear attack, exponential decay to sustain, exponential release after the gate. */
function shape(param: AudioParam, t: number, peak: number, gate: number, env: Envelope): void {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + env.attack);
  param.setTargetAtTime(peak * env.sustain, t + env.attack, Math.max(env.decay, 0.001) / 4);
  param.setTargetAtTime(0, Math.max(t + gate, t + env.attack), Math.max(env.release, 0.001) / 4);
}

function filterNode(ctx: BaseAudioContext, t: number, f: Filter): BiquadFilterNode {
  const node = new BiquadFilterNode(ctx, { type: f.type, frequency: f.freq, Q: f.q ?? 0.7 });
  if (f.to !== undefined) {
    node.frequency.setValueAtTime(f.freq, t);
    node.frequency.exponentialRampToValueAtTime(f.to, t + (f.time ?? 0.1));
  }
  return node;
}

function route(ctx: BaseAudioContext, amp: GainNode, out: Output, send = 0): AudioNode[] {
  amp.connect(out.dry);
  if (send <= 0) return [];
  const wet = new GainNode(ctx, { gain: send });
  amp.connect(wet).connect(out.wet);
  return [wet];
}

function releaseWhenDone(sources: AudioScheduledSourceNode[], nodes: AudioNode[]): void {
  let remaining = sources.length;
  for (const source of sources) {
    source.onended = () => {
      remaining -= 1;
      if (remaining === 0) for (const node of nodes) node.disconnect();
    };
  }
}
