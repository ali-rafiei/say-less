import {
  DRAW_COLORS,
  DRAW_WIDTHS,
  DRAWING_SIZE,
  decodeDrawing,
  type Drawing,
} from '@say-less/shared';
import { useMemo } from 'react';

interface Props {
  drawing: Drawing | string;
  label: string;
  className?: string;
}

const PAPER = DRAW_COLORS[DRAW_COLORS.length - 1]!;
const EMPTY: Drawing = { strokes: [] };

/** Read-only drawing; a string is the wire encoding and an undecodable one shows blank paper. */
export function DrawingView({ drawing, label, className }: Props) {
  const decoded = useMemo(
    () => (typeof drawing === 'string' ? tryDecode(drawing) : drawing),
    [drawing],
  );

  return (
    <svg
      className={className}
      viewBox={`0 0 ${DRAWING_SIZE} ${DRAWING_SIZE}`}
      role="img"
      aria-label={label}
      style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '1 / 1' }}
    >
      <rect width={DRAWING_SIZE} height={DRAWING_SIZE} rx={16} fill={PAPER} />
      {decoded.strokes.map((stroke, index) => (
        <path
          key={index}
          d={strokePath(stroke.points)}
          fill="none"
          stroke={DRAW_COLORS[stroke.color]}
          strokeWidth={DRAW_WIDTHS[stroke.width]}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/** A single point becomes a zero-length segment, which round caps draw as a dot. */
export function strokePath(points: readonly number[]): string {
  let d = `M${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) d += `L${points[i]} ${points[i + 1]}`;
  return points.length === 2 ? `${d}L${points[0]} ${points[1]}` : d;
}

function tryDecode(encoded: string): Drawing {
  try {
    return decodeDrawing(encoded);
  } catch {
    // Malformed input from the wire is shown as blank paper rather than crashing the screen.
    return EMPTY;
  }
}
