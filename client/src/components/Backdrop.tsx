import { useEffect } from 'react';

export type Palette = 'home' | 'lobby' | 'writing' | 'voting' | 'results' | 'podium';

const PAINTED: readonly Palette[] = ['home', 'lobby', 'writing', 'voting', 'results', 'podium'];
const PRELOAD_DELAY_MS = 1_500;

/** The current phase's painting, pinned to the screen while the page scrolls over it. */
export function Backdrop({ palette }: { palette: Palette }) {
  useEffect(() => {
    // Fetch every painting once the first screen is up, so a phase change never waits on one.
    const t = setTimeout(() => {
      for (const name of PAINTED) new Image().src = paintingUrl(name);
    }, PRELOAD_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      key={palette}
      className="backdrop"
      style={{ backgroundImage: `url(${paintingUrl(palette)})` }}
      aria-hidden="true"
    />
  );
}

function paintingUrl(palette: Palette): string {
  return `${import.meta.env.BASE_URL}backgrounds/${palette}.webp`;
}
