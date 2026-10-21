import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTER_IDS } from '@say-less/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Character, type CharacterState } from '../src/components/Character.tsx';

const STATES: CharacterState[] = ['idle', 'writing', 'waiting', 'win', 'lose'];

describe('Character', () => {
  it('shows the sprite on the first render, with nothing to load first', () => {
    // Act
    const html = renderToStaticMarkup(<Character characterId="bigfoot" state="win" />);

    // Assert
    expect(html).toContain('src="/sprites/bigfoot/win.webp"');
  });

  it('has a sprite for every state of every character', () => {
    // Arrange
    const sprite = (id: string, state: string) =>
      fileURLToPath(new URL(`../public/sprites/${id}/${state}.webp`, import.meta.url));

    // Act
    const missing = CHARACTER_IDS.flatMap((id) =>
      STATES.filter((state) => !existsSync(sprite(id, state))).map((state) => `${id}/${state}`),
    );

    // Assert
    expect(missing).toEqual([]);
  });

  it('shows an empty placeholder for no character or an unknown one', () => {
    // Act
    const html = renderToStaticMarkup(
      <>
        <Character characterId={null} />
        <Character characterId="cat" />
      </>,
    );

    // Assert
    expect(html.match(/char-empty/g)).toHaveLength(2);
    expect(html).not.toContain('<img');
  });
});
