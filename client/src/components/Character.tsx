import { CHARACTER_IDS } from '@say-less/shared';
import { useEffect, useState } from 'react';
import blob from '../characters/svg/blob.svg?raw';
import cactus from '../characters/svg/cactus.svg?raw';
import ghost from '../characters/svg/ghost.svg?raw';
import grandma from '../characters/svg/grandma.svg?raw';
import icecream from '../characters/svg/icecream.svg?raw';
import lemon from '../characters/svg/lemon.svg?raw';
import pigeon from '../characters/svg/pigeon.svg?raw';
import raccoon from '../characters/svg/raccoon.svg?raw';
import sock from '../characters/svg/sock.svg?raw';
import toast from '../characters/svg/toast.svg?raw';

export type CharacterState = 'idle' | 'writing' | 'waiting' | 'win' | 'lose';

const SVGS: Record<string, string> = {
  lemon,
  raccoon,
  icecream,
  grandma,
  sock,
  cactus,
  toast,
  pigeon,
  ghost,
  blob,
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
