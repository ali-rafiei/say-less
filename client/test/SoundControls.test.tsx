import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function renderWith(stored: Record<string, string>): Promise<string> {
  const values = new Map(Object.entries(stored));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  });
  const { SoundControls } = await import('../src/components/SoundControls.tsx');
  return renderToStaticMarkup(<SoundControls />);
}

describe('SoundControls', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('starts as one collapsed, named header button', async () => {
    // Act
    const html = await renderWith({});

    // Assert
    expect(html).toContain('aria-label="Sound settings"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('aria-pressed');
  });

  it('shows the silent speaker only when music and effects are both off', async () => {
    // Act
    const bothOff = await renderWith({ 'say-less.muted': '1', 'say-less.music': '0' });
    vi.resetModules();
    const musicOnly = await renderWith({ 'say-less.muted': '1' });

    // Assert
    expect(bothOff).toContain('ui/sound-off.webp');
    expect(musicOnly).toContain('ui/sound-on.webp');
  });
});
