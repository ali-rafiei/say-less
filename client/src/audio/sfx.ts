import type { RoomPhase } from '@say-less/shared';

/**
 * All sounds are synthesized with WebAudio so the game ships no audio assets.
 * The context is created lazily on the first user gesture (browser autoplay rules).
 */
class Sfx {
  private ctx: AudioContext | null = null;
  muted = (() => {
    try {
      return localStorage.getItem('say-less.muted') === '1';
    } catch {
      return false;
    }
  })();

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('say-less.muted', muted ? '1' : '0');
    } catch {
      // ignore
    }
  }

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  tap(): void {
    this.tone({ freq: 620, type: 'square', duration: 0.05, gain: 0.05 });
  }

  typewriter(): void {
    this.noise({ duration: 0.03, gain: 0.12, highpass: 2500 });
  }

  micDrop(): void {
    this.tone({ freq: 160, type: 'sine', duration: 0.25, gain: 0.3, slideTo: 50 });
    setTimeout(() => this.noise({ duration: 0.35, gain: 0.35, highpass: 200 }), 200);
    setTimeout(() => this.noise({ duration: 0.12, gain: 0.15, highpass: 200 }), 520);
  }

  roast(): void {
    this.tone({ freq: 880, type: 'sawtooth', duration: 0.5, gain: 0.12, slideTo: 220 });
    this.noise({ duration: 0.6, gain: 0.08, highpass: 4000 });
  }

  win(): void {
    [523, 659, 784, 1046].forEach((freq, i) =>
      setTimeout(() => this.tone({ freq, type: 'triangle', duration: 0.18, gain: 0.12 }), i * 90),
    );
  }

  lose(): void {
    this.tone({ freq: 300, type: 'triangle', duration: 0.4, gain: 0.12, slideTo: 120 });
  }

  shatter(): void {
    this.noise({ duration: 0.25, gain: 0.25, highpass: 1500 });
    this.tone({ freq: 1200, type: 'square', duration: 0.08, gain: 0.05 });
  }

  tick(): void {
    this.tone({ freq: 1000, type: 'square', duration: 0.03, gain: 0.04 });
  }

  error(): void {
    this.tone({ freq: 200, type: 'square', duration: 0.12, gain: 0.08 });
  }

  phase(phase: RoomPhase): void {
    switch (phase) {
      case 'ROUND_INTRO':
        this.shatter();
        return;
      case 'PODIUM':
        this.win();
        return;
      case 'VOTING':
      case 'FINAL_VOTING':
        this.tone({ freq: 440, type: 'triangle', duration: 0.12, gain: 0.08 });
        return;
      default:
        return;
    }
  }

  private tone(opts: {
    freq: number;
    type: OscillatorType;
    duration: number;
    gain: number;
    slideTo?: number;
  }): void {
    const ctx = this.ready();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, ctx.currentTime);
    if (opts.slideTo)
      osc.frequency.exponentialRampToValueAtTime(opts.slideTo, ctx.currentTime + opts.duration);
    amp.gain.setValueAtTime(opts.gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + opts.duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + opts.duration + 0.02);
  }

  private noise(opts: { duration: number; gain: number; highpass: number }): void {
    const ctx = this.ready();
    if (!ctx) return;
    const frames = Math.floor(ctx.sampleRate * opts.duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = opts.highpass;
    const amp = ctx.createGain();
    amp.gain.value = opts.gain;
    source.connect(filter).connect(amp).connect(ctx.destination);
    source.start();
  }

  private ready(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }
}

export const sfx = new Sfx();
