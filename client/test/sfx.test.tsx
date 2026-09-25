import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

async function freshSfx(stored: Record<string, string> = {}) {
  const storage = memoryStorage(stored);
  vi.stubGlobal('localStorage', storage);
  const { sfx } = await import('../src/audio/sfx.ts');
  return { sfx, storage };
}

describe('sfx settings', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('starts with effects and music both on for a new player', async () => {
    // Act
    const { sfx } = await freshSfx();

    // Assert
    expect(sfx.muted).toBe(false);
    expect(sfx.musicOn).toBe(true);
  });

  it('keeps a saved mute as effects muted without turning music off', async () => {
    // Act
    const { sfx } = await freshSfx({ 'say-less.muted': '1' });

    // Assert
    expect(sfx.muted).toBe(true);
    expect(sfx.musicOn).toBe(true);
  });

  it('remembers music being switched off separately from effects', async () => {
    // Arrange
    const { sfx, storage } = await freshSfx();

    // Act
    sfx.setMusicOn(false);

    // Assert
    expect(storage.getItem('say-less.music')).toBe('0');
    expect(storage.getItem('say-less.muted')).toBeNull();
  });

  it('restores music being off on the next visit', async () => {
    // Act
    const { sfx } = await freshSfx({ 'say-less.music': '0' });

    // Assert
    expect(sfx.musicOn).toBe(false);
  });

  it('tells subscribers when either setting changes', async () => {
    // Arrange
    const { sfx } = await freshSfx();
    const listener = vi.fn();
    const unsubscribe = sfx.subscribe(listener);

    // Act
    sfx.setMuted(true);
    sfx.setMusicOn(false);
    unsubscribe();
    sfx.setMuted(false);

    // Assert
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
