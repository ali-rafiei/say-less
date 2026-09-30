export const DRAWING_SIZE = 256;

/** Ink first, paper last: paper doubles as the eraser. */
export const DRAW_COLORS: readonly string[] = [
  '#1a1a2e',
  '#e63946',
  '#ff8c42',
  '#ffd23f',
  '#2fbf71',
  '#2f80ed',
  '#8e44ad',
  '#fffdf6',
];

export const DRAW_WIDTHS: readonly number[] = [3, 8, 18];

export const DRAWING_LIMITS = {
  MAX_STROKES: 300,
  MAX_POINTS: 6000,
  MAX_ENCODED_CHARS: 24_000,
} as const;

/** `color` and `width` index DRAW_COLORS and DRAW_WIDTHS; `points` is flat [x0, y0, x1, y1, ...] with integers 0..255. */
export interface Stroke {
  color: number;
  width: number;
  points: number[];
}

export interface Drawing {
  strokes: Stroke[];
}

export class DrawingError extends Error {}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const PAPER_COLOR = DRAW_COLORS.length - 1;
const STROKE_HEADER_BYTES = 3;

/**
 * Layout, per stroke, concatenated with no header or footer:
 *   byte 0     colour index << 4 | width index
 *   bytes 1-2  point count, big-endian
 *   then       one byte x and one byte y per point
 * The bytes are written as unpadded URL-safe base64.
 */
export function encodeDrawing(drawing: Drawing): string {
  const strokes = drawing.strokes;
  if (strokes.length > DRAWING_LIMITS.MAX_STROKES) {
    throw new DrawingError(
      `Drawing has ${strokes.length} strokes; the limit is ${DRAWING_LIMITS.MAX_STROKES}`,
    );
  }
  const bytes: number[] = [];
  let totalPoints = 0;
  for (const [index, stroke] of strokes.entries()) {
    validateStroke(stroke, index);
    const count = stroke.points.length / 2;
    totalPoints += count;
    if (totalPoints > DRAWING_LIMITS.MAX_POINTS) {
      throw new DrawingError(`Drawing has more than ${DRAWING_LIMITS.MAX_POINTS} points`);
    }
    bytes.push((stroke.color << 4) | stroke.width, count >> 8, count & 0xff);
    for (const value of stroke.points) bytes.push(value);
  }
  return toBase64Url(bytes);
}

/** Only ever throws DrawingError; work is bounded by the input length. */
export function decodeDrawing(encoded: string): Drawing {
  if (typeof encoded !== 'string') throw new DrawingError('Encoded drawing must be a string');
  if (encoded.length > DRAWING_LIMITS.MAX_ENCODED_CHARS) {
    throw new DrawingError(
      `Encoded drawing is ${encoded.length} chars; the limit is ${DRAWING_LIMITS.MAX_ENCODED_CHARS}`,
    );
  }
  const bytes = fromBase64Url(encoded);
  const strokes: Stroke[] = [];
  let totalPoints = 0;
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + STROKE_HEADER_BYTES > bytes.length) {
      throw new DrawingError('Truncated stroke header');
    }
    if (strokes.length >= DRAWING_LIMITS.MAX_STROKES) {
      throw new DrawingError(`Drawing has more than ${DRAWING_LIMITS.MAX_STROKES} strokes`);
    }
    const style = bytes[offset]!;
    const color = style >> 4;
    const width = style & 0x0f;
    const count = (bytes[offset + 1]! << 8) | bytes[offset + 2]!;
    offset += STROKE_HEADER_BYTES;
    if (color >= DRAW_COLORS.length) throw new DrawingError(`Unknown colour index ${color}`);
    if (width >= DRAW_WIDTHS.length) throw new DrawingError(`Unknown width index ${width}`);
    if (count === 0) throw new DrawingError('Stroke has no points');
    totalPoints += count;
    if (totalPoints > DRAWING_LIMITS.MAX_POINTS) {
      throw new DrawingError(`Drawing has more than ${DRAWING_LIMITS.MAX_POINTS} points`);
    }
    if (offset + count * 2 > bytes.length) throw new DrawingError('Truncated stroke points');
    strokes.push({ color, width, points: bytes.slice(offset, offset + count * 2) });
    offset += count * 2;
  }
  return { strokes };
}

export function isBlankDrawing(drawing: Drawing): boolean {
  return drawing.strokes.every((stroke) => stroke.color === PAPER_COLOR);
}

function validateStroke(stroke: Stroke, index: number): void {
  if (!Number.isInteger(stroke.color) || stroke.color < 0 || stroke.color >= DRAW_COLORS.length) {
    throw new DrawingError(`Stroke ${index} has an invalid colour index`);
  }
  if (!Number.isInteger(stroke.width) || stroke.width < 0 || stroke.width >= DRAW_WIDTHS.length) {
    throw new DrawingError(`Stroke ${index} has an invalid width index`);
  }
  if (stroke.points.length === 0 || stroke.points.length % 2 !== 0) {
    throw new DrawingError(`Stroke ${index} needs at least one x,y pair`);
  }
  for (const value of stroke.points) {
    if (!Number.isInteger(value) || value < 0 || value >= DRAWING_SIZE) {
      throw new DrawingError(`Stroke ${index} has a point outside 0..${DRAWING_SIZE - 1}`);
    }
  }
}

function toBase64Url(bytes: readonly number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(chunk >> 18) & 63]! + ALPHABET[(chunk >> 12) & 63]!;
    if (i + 1 < bytes.length) out += ALPHABET[(chunk >> 6) & 63]!;
    if (i + 2 < bytes.length) out += ALPHABET[chunk & 63]!;
  }
  return out;
}

function fromBase64Url(encoded: string): number[] {
  if (encoded.length % 4 === 1) throw new DrawingError('Encoded drawing has an impossible length');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < encoded.length; i++) {
    const value = ALPHABET.indexOf(encoded[i]!);
    if (value < 0) throw new DrawingError(`Encoded drawing has an invalid character at ${i}`);
    buffer = ((buffer << 6) | value) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  // Leftover bits must be zero so each drawing has exactly one encoding.
  if ((buffer & ((1 << bits) - 1)) !== 0) {
    throw new DrawingError('Encoded drawing has stray trailing bits');
  }
  return bytes;
}
