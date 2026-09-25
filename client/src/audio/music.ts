import { glide, type AudioGraph, type Output } from './graph.ts';
import * as play from './instruments.ts';
import { STEPS_PER_BAR, type Chord, type MixChannel, type Pattern, type Song } from './songs.ts';

const FADE_IN = 0.6;
const FADE_OUT = 0.8;

interface Playback {
  song: Song;
  pattern: Pattern;
  step: number;
  /** Grid time of `step` on the AudioContext clock. */
  time: number;
  land: boolean;
  lane: Output & { gains: GainNode[] };
}

/** 16th-step sequencer; the caller pumps it ahead of the AudioContext clock. */
export class MusicPlayer {
  private playback: Playback | null = null;

  constructor(private readonly graph: AudioGraph) {}

  get playing(): boolean {
    return this.playback !== null;
  }

  /** Crossfade to `song`; a song already playing (or already looping) carries on. */
  play(song: Song | null, fromLoop = false): void {
    const current = this.playback;
    if (
      song &&
      current &&
      (current.song === song || (!song.intro && current.song.loop === song.loop))
    ) {
      return;
    }
    const now = this.graph.ctx.currentTime;
    if (current) this.fadeOut(current, now);
    this.playback = song ? this.start(song, now + 0.05, fromLoop || !song.intro) : null;
  }

  /** Schedule every step whose time falls before `until`, skipping any already in the past. */
  pump(now: number, until: number): void {
    const p = this.playback;
    if (!p) return;
    while (p.time < now - 0.02) this.advance(p);
    while (p.time < until) {
      this.schedule(p);
      this.advance(p);
    }
  }

  private start(song: Song, at: number, fromLoop: boolean): Playback {
    const { ctx } = this.graph;
    const dry = new GainNode(ctx, { gain: 0 });
    const wet = new GainNode(ctx, { gain: 0 });
    dry.connect(this.graph.music.dry);
    wet.connect(this.graph.music.wet);
    for (const gain of [dry, wet]) {
      gain.gain.setValueAtTime(fromLoop ? 0 : 1, at);
      gain.gain.linearRampToValueAtTime(1, at + (fromLoop ? FADE_IN : 0.01));
    }
    return {
      song,
      pattern: fromLoop ? song.loop : song.intro!,
      step: 0,
      time: at,
      land: false,
      lane: { dry, wet, gains: [dry, wet] },
    };
  }

  private fadeOut(p: Playback, now: number): void {
    for (const gain of p.lane.gains) glide(gain.gain, 0, now, FADE_OUT / 4);
    setTimeout(() => p.lane.gains.forEach((gain) => gain.disconnect()), (FADE_OUT + 0.6) * 1000);
  }

  private advance(p: Playback): void {
    p.time += stepLength(p.pattern);
    p.step += 1;
    if (p.step < p.pattern.bars * STEPS_PER_BAR) return;
    p.step = 0;
    if (p.pattern !== p.song.loop) {
      p.pattern = p.song.loop;
      p.land = p.song.land ?? false;
    }
  }

  private schedule(p: Playback): void {
    const { pattern, step, lane } = p;
    const { tracks } = pattern;
    const unit = stepLength(pattern);
    const t = p.time + (step % 2 === 1 ? pattern.swing * unit : 0);
    const level = (channel: MixChannel) => pattern.mix[channel] ?? 0.5;
    const g = this.graph;

    if (p.land && step === 0) {
      play.crash(g, lane, t, 0.5);
      play.kick(g, lane, t, 0.9);
      p.land = false;
    }

    const kick = hit(tracks.kick, step);
    if (kick) play.kick(g, lane, t, velocity(kick) * level('kick'));
    const snare = hit(tracks.snare, step);
    if (snare) play.snare(g, lane, t, velocity(snare) * level('snare'));
    const hat = hit(tracks.hat, step);
    if (hat) play.hat(g, lane, t, velocity(hat) * level('hat'), hat === 'o');
    const tick = hit(tracks.tick, step);
    if (tick) play.tick(g, lane, t, level('tick'), tick === 'X');
    const crash = hit(tracks.crash, step);
    if (crash) play.crash(g, lane, t, level('crash'));
    const riser = hit(tracks.riser, step);
    if (riser) play.riser(g, lane, t, level('riser'), held(tracks.riser!, step) * unit);

    const chord = chordAt(pattern, step);
    const bass = hit(tracks.bass, step);
    if (bass) {
      const length = held(tracks.bass!, step);
      play.bass(
        g,
        lane,
        t,
        level('bass'),
        bassNote(bass, chord, nextChord(pattern, step)),
        length * unit,
      );
    }
    const keys = hit(tracks.keys, step);
    if (keys) {
      const length = held(tracks.keys!, step) * unit;
      play.keys(g, lane, t, velocity(keys) * level('keys'), pattern.keys, chord.notes, length);
    }
    for (const [at, midi, length] of pattern.lead ?? []) {
      if (at === step) play.bell(g, lane, t, level('lead'), midi, length * unit);
    }
  }
}

function stepLength(pattern: Pattern): number {
  return 60 / pattern.bpm / 4;
}

function hit(track: string | undefined, step: number): string | null {
  if (!track) return null;
  const symbol = track[step % track.length]!;
  return symbol === '.' || symbol === '-' ? null : symbol;
}

/** Steps a note lasts: itself plus the '-' run after it. */
function held(track: string, step: number): number {
  let i = (step % track.length) + 1;
  while (track[i] === '-') i += 1;
  return i - (step % track.length);
}

function velocity(symbol: string): number {
  if (symbol === 'X') return 1;
  if (symbol === 'g') return 0.4;
  return 0.75;
}

function chordAt(pattern: Pattern, step: number): Chord {
  return pattern.chords[Math.floor(step / pattern.chordSteps) % pattern.chords.length]!;
}

function nextChord(pattern: Pattern, step: number): Chord {
  return pattern.chords[(Math.floor(step / pattern.chordSteps) + 1) % pattern.chords.length]!;
}

function bassNote(symbol: string, chord: Chord, next: Chord): number {
  switch (symbol) {
    case 'o':
      return chord.root + 12;
    case 'f':
      return chord.root + 7;
    case 'l':
      return chord.root - 5;
    case 'a':
      return next.root - 1;
    default:
      return chord.root;
  }
}
