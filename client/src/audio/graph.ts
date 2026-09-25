/** Music sits about 18 dB under the effects. */
export const MUSIC_LEVEL = 10 ** (-18 / 20);

export interface Output {
  dry: AudioNode;
  wet: AudioNode;
}

/** Effects and music buses sharing one reverb, into a glue compressor and limiter. */
export class AudioGraph {
  readonly fx: Output;
  readonly music: Output;
  readonly noise: AudioBuffer;
  private readonly musicGains: GainNode[];
  private musicTarget: number;

  constructor(
    readonly ctx: BaseAudioContext,
    musicOn = true,
  ) {
    this.musicTarget = musicOn ? MUSIC_LEVEL : 0;
    const limiter = new DynamicsCompressorNode(ctx, {
      threshold: -3,
      knee: 0,
      ratio: 20,
      attack: 0.001,
      release: 0.12,
    });
    limiter.connect(ctx.destination);
    const master = new GainNode(ctx, { gain: 0.85 });
    master.connect(limiter);
    const glue = new DynamicsCompressorNode(ctx, {
      threshold: -16,
      knee: 8,
      ratio: 3,
      attack: 0.01,
      release: 0.2,
    });
    glue.connect(master);

    const reverb = new ConvolverNode(ctx, { buffer: impulse(ctx, 1.8) });
    const reverbReturn = new GainNode(ctx, { gain: 0.6 });
    reverb.connect(reverbReturn).connect(glue);

    const fxDry = new GainNode(ctx);
    fxDry.connect(glue);
    const fxWet = new GainNode(ctx);
    fxWet.connect(reverb);
    this.fx = { dry: fxDry, wet: fxWet };

    const musicDry = new GainNode(ctx, { gain: this.musicTarget });
    musicDry.connect(glue);
    const musicWet = new GainNode(ctx, { gain: this.musicTarget });
    musicWet.connect(reverb);
    this.music = { dry: musicDry, wet: musicWet };
    this.musicGains = [musicDry, musicWet];

    this.noise = whiteNoise(ctx, 2);
  }

  /** Fade the whole music bus to on or off; `seconds` is roughly the time to silence. */
  setMusicOn(on: boolean, seconds = 0.3): void {
    this.musicTarget = on ? MUSIC_LEVEL : 0;
    for (const gain of this.musicGains)
      glide(gain.gain, this.musicTarget, this.ctx.currentTime, seconds / 4);
  }

  /** Pull the music down under an effect, then let it back up. */
  duck(at: number, depth: number, hold: number): void {
    if (this.musicTarget === 0) return;
    for (const gain of this.musicGains) {
      glide(gain.gain, this.musicTarget * depth, at, 0.012);
      gain.gain.setTargetAtTime(this.musicTarget, at + hold, 0.18);
    }
  }
}

/** Move a param smoothly from wherever it is now, cancelling pending automation. */
export function glide(param: AudioParam, value: number, at: number, timeConstant: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(at);
  } else {
    param.cancelScheduledValues(at);
    param.setValueAtTime(param.value, at);
  }
  param.setTargetAtTime(value, at, timeConstant);
}

function whiteNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** A decaying stereo noise tail, darkened as it decays, used as a small-room impulse. */
function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let smoothed = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const brightness = 0.9 - progress * 0.75;
      smoothed += brightness * (Math.random() * 2 - 1 - smoothed);
      data[i] = smoothed * (1 - progress) ** 3;
    }
  }
  return buffer;
}
