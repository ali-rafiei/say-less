import { describe, expect, it } from 'vitest';
import { LoopBookmarks } from '../src/audio/music.ts';
import { STEPS_PER_BAR, type Pattern } from '../src/audio/songs.ts';

const loop = (bars: number) => ({ bars }) as Pattern;

describe('LoopBookmarks', () => {
  it('starts a loop from the top the first time it plays', () => {
    // Arrange
    const bookmarks = new LoopBookmarks();

    // Act / Assert
    expect(bookmarks.resume(loop(32))).toBe(0);
  });

  it('resumes a loop at the start of the bar it had reached, so voting runs on across matchups', () => {
    // Arrange
    const bookmarks = new LoopBookmarks();
    const voting = loop(36);

    // Act: the reveal fades voting out partway through bar 9
    bookmarks.remember(voting, 8 * STEPS_PER_BAR + 5);

    // Assert
    expect(bookmarks.resume(voting)).toBe(8 * STEPS_PER_BAR);
  });

  it('keeps a separate place for each loop', () => {
    // Arrange
    const bookmarks = new LoopBookmarks();
    const lobby = loop(64);
    const writing = loop(40);

    // Act
    bookmarks.remember(lobby, 20 * STEPS_PER_BAR);
    bookmarks.remember(writing, 3 * STEPS_PER_BAR);

    // Assert
    expect(bookmarks.resume(lobby)).toBe(20 * STEPS_PER_BAR);
    expect(bookmarks.resume(writing)).toBe(3 * STEPS_PER_BAR);
  });
});
