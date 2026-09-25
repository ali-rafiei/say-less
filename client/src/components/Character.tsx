import { CHARACTER_IDS } from '@say-less/shared';
import { useEffect, useState } from 'react';
import axolotl from '../characters/svg/axolotl.svg?raw';
import bear from '../characters/svg/bear.svg?raw';
import bird from '../characters/svg/bird.svg?raw';
import blob from '../characters/svg/blob.svg?raw';
import cat from '../characters/svg/cat.svg?raw';
import fish from '../characters/svg/fish.svg?raw';
import frog from '../characters/svg/frog.svg?raw';
import hedgehog from '../characters/svg/hedgehog.svg?raw';
import monkey from '../characters/svg/monkey.svg?raw';
import otter from '../characters/svg/otter.svg?raw';
import penguin from '../characters/svg/penguin.svg?raw';
import rabbit from '../characters/svg/rabbit.svg?raw';

export type CharacterState = 'idle' | 'writing' | 'waiting' | 'win' | 'lose';

const SVGS: Record<string, string> = {
  cat,
  monkey,
  frog,
  bird,
  axolotl,
  bear,
  rabbit,
  fish,
  blob,
  otter,
  penguin,
  hedgehog,
};

/**
 * Optional raster sprites (from /public/sprites/<id>/<state>.png, listed in
 * manifest.json) override the vector placeholder for that state.
 */
type SpriteManifest = Record<string, string[]>;
let manifestPromise: Promise<SpriteManifest> | null = null;
let manifestCache: SpriteManifest = {};
function loadManifest(): Promise<SpriteManifest> {
  manifestPromise ??= fetch(`${import.meta.env.BASE_URL}sprites/manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<SpriteManifest>) : {}))
    .then((m) => (manifestCache = m))
    .catch(() => ({}));
  return manifestPromise;
}

function useSpriteManifest(): SpriteManifest {
  const [manifest, setManifest] = useState<SpriteManifest>(manifestCache);
  useEffect(() => {
    let live = true;
    void loadManifest().then((m) => live && setManifest(m));
    return () => {
      live = false;
    };
  }, []);
  return manifest;
}

interface Props {
  characterId: string | null;
  state?: CharacterState;
  size?: number | string;
  className?: string;
}

export function Character({ characterId, state = 'idle', size = 96, className = '' }: Props) {
  const manifest = useSpriteManifest();
  const dimension = typeof size === 'number' ? `${size}px` : size;
  const style = { width: dimension, height: dimension };
  if (!characterId || !CHARACTER_IDS.includes(characterId)) {
    return <div className={`char-wrap char-empty ${className}`} style={style} data-state={state} />;
  }
  const sprite = manifest[characterId]?.includes(state)
    ? `${import.meta.env.BASE_URL}sprites/${characterId}/${state}.png`
    : null;
  if (sprite) {
    return (
      <div
        className={`char-wrap char-sprite char-${characterId} ${className}`}
        style={style}
        data-state={state}
      >
        <img src={sprite} alt="" draggable={false} />
      </div>
    );
  }
  return (
    <div
      className={`char-wrap ${className}`}
      style={style}
      data-state={state}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: SVGS[characterId] ?? '' }}
    />
  );
}
