import type { RoomPhase } from '@say-less/shared';
import * as effects from './effects.ts';
import { AudioGraph } from './graph.ts';
import { MusicPlayer } from './music.ts';
import { songFor } from './songs.ts';

const EFFECTS_MUTED_KEY = 'say-less.muted';
const MUSIC_KEY = 'say-less.music';
const SCHEDULE_EVERY_MS = 25;
const SCHEDULE_AHEAD = 0.1;

/**
 * All sounds and music are synthesized with WebAudio so the game ships no audio assets.
 * The context is created lazily on the first user gesture (browser autoplay rules).
 */
class Sfx {
  /** Effects muted; music has its own switch. */
  muted = read(EFFECTS_MUTED_KEY) === '1';
  musicOn = read(MUSIC_KEY) !== '0';
  private ctx: AudioContext | null = null;
  private graph: AudioGraph | null = null;
  private music: MusicPlayer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentPhase: RoomPhase | null = null;
  private readonly listeners = new Set<() => void>();

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.onVisibilityChange());
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setMuted(muted: boolean): void {
    this.muted = muted;
    write(EFFECTS_MUTED_KEY, muted ? '1' : '0');
    this.notify();
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    write(MUSIC_KEY, on ? '1' : '0');
    this.notify();
    if (!this.graph || !this.music) return;
    this.graph.setMusicOn(on);
    this.music.play(on ? songFor(this.currentPhase) : null, true);
    this.startScheduler();
  }

  unlock(): void {
    if (!this.ctx || this.ctx.state === 'closed') this.createContext();
    const ctx = this.ctx;
    if (!ctx) return;
    // iOS reports "interrupted" after calls and Siri; only a gesture can resume it.
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    if (this.musicOn && this.music && !this.music.playing) {
      this.music.play(songFor(this.currentPhase), true);
    }
    this.startScheduler();
  }

  tap(): void {
    this.play(effects.tap);
  }

  typewriter(): void {
    this.play(effects.typewriter);
  }

  micDrop(): void {
    this.play(effects.micDrop);
  }

  roast(): void {
    this.play(effects.roast);
  }

  win(): void {
    this.play(effects.win);
  }

  lose(): void {
    this.play(effects.lose);
  }

  shatter(): void {
    this.play(effects.shatter);
  }

  tick(): void {
    this.play(effects.tick);
  }

  error(): void {
    this.play(effects.error);
  }

  /** `null` is the home screen. */
  phase(phase: RoomPhase | null): void {
    this.currentPhase = phase;
    switch (phase) {
      case 'ROUND_INTRO':
        // Lands with the round intro's tiles shattering.
        this.play(effects.shatter, 0.9);
        break;
      case 'PODIUM':
        this.play(effects.win);
        break;
      case 'VOTING':
      case 'FINAL_VOTING':
        this.play(effects.votingChime);
        break;
      default:
        break;
    }
    if (this.musicOn && this.music) {
      this.music.play(songFor(phase));
      this.startScheduler();
    }
  }

  private play(effect: effects.Effect, delay = 0): void {
    const graph = this.ready();
    if (!graph) return;
    const t = graph.ctx.currentTime + delay;
    const length = effect(graph, t) - t;
    graph.duck(t, length > 0.2 ? 0.35 : 0.7, length);
  }

  private ready(): AudioGraph | null {
    if (this.muted || !this.ctx || !this.graph) return null;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return null;
    // Anything scheduled on a stopped clock would burst out on resume.
    if (this.ctx.state !== 'running' && this.ctx.state !== 'suspended') return null;
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.graph;
  }

  private createContext(): void {
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
      return;
    }
    this.graph = new AudioGraph(this.ctx, this.musicOn);
    this.music = new MusicPlayer(this.graph);
    this.ctx.addEventListener('statechange', () => this.startScheduler());
  }

  private startScheduler(): void {
    if (this.timer !== null || !this.music?.playing) return;
    this.timer = setInterval(() => this.schedule(), SCHEDULE_EVERY_MS);
  }

  private stopScheduler(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const { ctx, music } = this;
    if (!ctx || !music?.playing || document.visibilityState === 'hidden') {
      this.stopScheduler();
      return;
    }
    if (ctx.state !== 'running') return;
    music.pump(ctx.currentTime, ctx.currentTime + SCHEDULE_AHEAD);
  }

  private onVisibilityChange(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return;
    if (document.visibilityState === 'hidden') {
      this.stopScheduler();
      void ctx.suspend().catch(() => undefined);
    } else {
      void ctx.resume().catch(() => undefined);
      this.startScheduler();
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked (private mode): the setting lasts for this visit only
  }
}

export const sfx = new Sfx();
