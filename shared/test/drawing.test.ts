import { describe, expect, it } from 'vitest';
import {
  DRAW_COLORS,
  DRAWING_LIMITS,
  DrawingError,
  decodeDrawing,
  encodeDrawing,
  isBlankDrawing,
  type Drawing,
  type Stroke,
} from '../src/drawing.ts';

const INK = 0;
const PAPER = DRAW_COLORS.length - 1;

function stroke(overrides: Partial<Stroke> = {}): Stroke {
  return { color: INK, width: 1, points: [0, 0, 10, 20, 255, 255], ...overrides };
}

function toBase64Url(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function wiggle(pointCount: number): number[] {
  return Array.from({ length: pointCount * 2 }, (_, i) => (i * 37) % 256);
}

describe('encodeDrawing and decodeDrawing', () => {
  it('round-trips strokes, colours, widths and points exactly', () => {
    // Arrange
    const drawing: Drawing = {
      strokes: [
        stroke(),
        stroke({ color: 3, width: 2, points: [7, 7] }),
        stroke({ color: PAPER, width: 0, points: [1, 2, 3, 4] }),
      ],
    };

    // Act
    const decoded = decodeDrawing(encodeDrawing(drawing));

    // Assert
    expect(decoded).toEqual(drawing);
  });

  it('round-trips an empty drawing', () => {
    // Act
    const encoded = encodeDrawing({ strokes: [] });

    // Assert
    expect(encoded).toBe('');
    expect(decodeDrawing(encoded)).toEqual({ strokes: [] });
  });

  it('produces only URL-safe characters', () => {
    // Arrange
    const drawing: Drawing = { strokes: [stroke({ points: wiggle(500) })] };

    // Act
    const encoded = encodeDrawing(drawing);

    // Assert
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('keeps a 6000-point drawing under the encoded size limit', () => {
    // Arrange
    const strokes = Array.from({ length: 60 }, () => stroke({ points: wiggle(100) }));

    // Act
    const encoded = encodeDrawing({ strokes });

    // Assert
    expect(encoded.length).toBeLessThan(DRAWING_LIMITS.MAX_ENCODED_CHARS);
    expect(decodeDrawing(encoded).strokes).toHaveLength(60);
  });

  it('keeps the worst case, 300 strokes sharing 6000 points, under the limit', () => {
    // Arrange
    const strokes = Array.from({ length: 300 }, () => stroke({ points: wiggle(20) }));

    // Act
    const encoded = encodeDrawing({ strokes });

    // Assert
    expect(encoded.length).toBeLessThan(DRAWING_LIMITS.MAX_ENCODED_CHARS);
  });
});

describe('decodeDrawing rejections', () => {
  const oneStroke = (style: number, count: number, ...points: number[]) =>
    toBase64Url([style, count >> 8, count & 0xff, ...points]);

  const rejected: Array<[string, () => string]> = [
    ['characters outside the URL-safe alphabet', () => 'AAAA+/=='],
    ['a length that cannot come from whole bytes', () => 'AAAAA'],
    ['stray non-zero trailing bits', () => 'AAB'],
    ['a truncated stroke header', () => toBase64Url([0x00, 0x00])],
    ['truncated point data', () => oneStroke(0x00, 3, 1, 2, 3, 4)],
    ['a stroke with no points', () => oneStroke(0x00, 0)],
    ['an out-of-range colour index', () => oneStroke(DRAW_COLORS.length << 4, 1, 1, 1)],
    ['an out-of-range width index', () => oneStroke(0x03, 1, 1, 1)],
    [
      'too many strokes',
      () =>
        toBase64Url(
          Array.from({ length: DRAWING_LIMITS.MAX_STROKES + 1 }, () => [
            0x00, 0x00, 0x01, 1, 1,
          ]).flat(),
        ),
    ],
    [
      'too many points',
      () =>
        oneStroke(
          0x00,
          DRAWING_LIMITS.MAX_POINTS + 1,
          ...new Array<number>((DRAWING_LIMITS.MAX_POINTS + 1) * 2).fill(1),
        ),
    ],
    [
      'an encoded string over the length limit',
      () => 'A'.repeat(DRAWING_LIMITS.MAX_ENCODED_CHARS + 1),
    ],
    ['a non-string input', () => 42 as unknown as string],
  ];

  it.each(rejected)('throws DrawingError for %s', (_name, build) => {
    // Arrange
    const encoded = build();

    // Act / Assert
    expect(() => decodeDrawing(encoded)).toThrow(DrawingError);
  });

  it('throws only DrawingError for random garbage', () => {
    // Arrange
    let seed = 1;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_+/= ';

    for (let round = 0; round < 500; round++) {
      const garbage = Array.from(
        { length: next() % 60 },
        () => alphabet[next() % alphabet.length],
      ).join('');

      // Act
      const attempt = () => decodeDrawing(garbage);

      // Assert
      try {
        attempt();
      } catch (error) {
        expect(error).toBeInstanceOf(DrawingError);
      }
    }
  });
});

describe('encodeDrawing rejections', () => {
  it.each([
    ['a colour index out of range', stroke({ color: 8 })],
    ['a width index out of range', stroke({ width: 3 })],
    ['a coordinate above 255', stroke({ points: [0, 256] })],
    ['a fractional coordinate', stroke({ points: [0.5, 1] })],
    ['an odd number of coordinates', stroke({ points: [1, 2, 3] })],
    ['a stroke with no points', stroke({ points: [] })],
  ])('throws DrawingError for %s', (_name, bad) => {
    // Act / Assert
    expect(() => encodeDrawing({ strokes: [bad] })).toThrow(DrawingError);
  });
});

describe('isBlankDrawing', () => {
  it('treats a drawing with no strokes as blank', () => {
    expect(isBlankDrawing({ strokes: [] })).toBe(true);
  });

  it('treats a drawing made only of paper-coloured strokes as blank', () => {
    // Arrange
    const erased: Drawing = { strokes: [stroke({ color: PAPER }), stroke({ color: PAPER })] };

    // Act / Assert
    expect(isBlankDrawing(erased)).toBe(true);
  });

  it('treats a drawing with any inked stroke as not blank', () => {
    // Arrange
    const drawn: Drawing = { strokes: [stroke({ color: PAPER }), stroke({ color: 1 })] };

    // Act / Assert
    expect(isBlankDrawing(drawn)).toBe(false);
  });
});
