import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UIArt } from '../src/components/UIArt.tsx';

describe('UIArt', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('loads its image from under the base path the app is deployed at', () => {
    // Arrange: GitHub Pages serves the app from /say-less/, not the domain root
    vi.stubEnv('BASE_URL', '/say-less/');

    // Act
    const html = renderToStaticMarkup(<UIArt name="logo" />);

    // Assert
    expect(html).toContain('src="/say-less/ui/logo.webp"');
  });
});
