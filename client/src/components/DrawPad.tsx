import '../styles/draw.css';
import {
  DRAW_COLORS,
  DRAW_WIDTHS,
  DRAWING_LIMITS,
  DRAWING_SIZE,
  type Drawing,
} from '@say-less/shared';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { DrawingView, strokePath } from './DrawingView.tsx';

interface Props {
  value: Drawing;
  onChange: (next: Drawing) => void;
  disabled?: boolean;
}

interface LiveStroke {
  pointerId: number;
  color: number;
  width: number;
  points: number[];
  /** Path data kept in step with points so a frame only appends. */
  path: string;
  frame: number | null;
}

/** Points closer than this to the previous one (in logical units) are dropped. */
const MIN_POINT_DISTANCE = 2;
const COLOR_NAMES = ['Ink', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Eraser'];
const WIDTH_NAMES = ['Thin brush', 'Medium brush', 'Thick brush'];
const ERASER = DRAW_COLORS.length - 1;

/** Finger drawing surface plus toolbar. Controlled: the parent owns (and persists) the Drawing. */
export function DrawPad({ value, onChange, disabled }: Props) {
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const liveElement = useRef<SVGPathElement>(null);
  const live = useRef<LiveStroke | null>(null);

  const usedPoints = value.strokes.reduce((sum, stroke) => sum + stroke.points.length / 2, 0);
  const full =
    value.strokes.length >= DRAWING_LIMITS.MAX_STROKES || usedPoints >= DRAWING_LIMITS.MAX_POINTS;
  const inert = disabled === true;
  const empty = value.strokes.length === 0;

  useEffect(() => {
    if (inert) discardLiveStroke();
  }, [inert]);
  useEffect(() => discardLiveStroke, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // Only the first finger draws; a second one is ignored until the first lifts.
    if (inert || full || live.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = [...toLogicalPoint(event)];
    live.current = {
      pointerId: event.pointerId,
      color,
      width,
      points,
      path: strokePath(points),
      frame: null,
    };
    liveElement.current?.setAttribute('d', live.current.path);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const stroke = live.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return;
    if (stroke.points.length / 2 >= DRAWING_LIMITS.MAX_POINTS - usedPoints) return;
    const [x, y] = toLogicalPoint(event);
    const lastX = stroke.points[stroke.points.length - 2]!;
    const lastY = stroke.points[stroke.points.length - 1]!;
    if (Math.hypot(x - lastX, y - lastY) < MIN_POINT_DISTANCE) return;
    stroke.points.push(x, y);
    stroke.path += `L${x} ${y}`;
    // Painting the in-progress stroke straight into the DOM keeps React out of the pointermove path.
    stroke.frame ??= requestAnimationFrame(() => {
      stroke.frame = null;
      liveElement.current?.setAttribute('d', stroke.path);
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const stroke = live.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return;
    discardLiveStroke();
    if (inert) return;
    onChange({
      strokes: [
        ...value.strokes,
        { color: stroke.color, width: stroke.width, points: stroke.points },
      ],
    });
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (live.current?.pointerId === event.pointerId) discardLiveStroke();
  }

  function discardLiveStroke() {
    const stroke = live.current;
    if (stroke?.frame != null) cancelAnimationFrame(stroke.frame);
    live.current = null;
    liveElement.current?.setAttribute('d', '');
  }

  return (
    <div className="drawpad">
      <div
        className={`drawpad__surface ${inert ? 'drawpad__surface--off' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <DrawingView className="drawpad__paper" drawing={value} label="Your drawing" />
        <svg
          className="drawpad__live"
          viewBox={`0 0 ${DRAWING_SIZE} ${DRAWING_SIZE}`}
          aria-hidden="true"
        >
          <path
            ref={liveElement}
            fill="none"
            stroke={DRAW_COLORS[color]}
            strokeWidth={DRAW_WIDTHS[width]}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="drawpad__full" role="status">
        {full ? 'Canvas full' : ''}
      </p>

      <div className="drawpad__colors" role="group" aria-label="Colour">
        {DRAW_COLORS.map((hex, index) => (
          <button
            key={hex}
            type="button"
            className={`drawpad__swatch ${index === color ? 'drawpad__swatch--on' : ''}`}
            style={{ background: hex }}
            aria-label={COLOR_NAMES[index]}
            aria-pressed={index === color}
            onClick={() => setColor(index)}
          >
            {index === ERASER && (
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path
                  d="M4 15 13 6l6 6-7 7H8zM9 10l6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        ))}
      </div>

      <div className="drawpad__row">
        <div className="drawpad__sizes" role="group" aria-label="Brush size">
          {DRAW_WIDTHS.map((size, index) => (
            <button
              key={size}
              type="button"
              className={`drawpad__size ${index === width ? 'drawpad__size--on' : ''}`}
              aria-label={WIDTH_NAMES[index]}
              aria-pressed={index === width}
              onClick={() => setWidth(index)}
            >
              <span className="drawpad__dot" style={{ width: size, height: size }} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn--small drawpad__undo"
          aria-label="Undo last stroke"
          disabled={inert || empty}
          onClick={() => onChange({ strokes: value.strokes.slice(0, -1) })}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn btn--small drawpad__clear"
          aria-label="Clear drawing"
          disabled={inert || empty}
          onClick={() => onChange({ strokes: [] })}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function toLogicalPoint(event: PointerEvent<HTMLDivElement>): [number, number] {
  const rect = event.currentTarget.getBoundingClientRect();
  const toUnit = (offset: number, extent: number) =>
    Math.min(DRAWING_SIZE - 1, Math.max(0, Math.round((offset / extent) * DRAWING_SIZE)));
  return [
    toUnit(event.clientX - rect.left, rect.width),
    toUnit(event.clientY - rect.top, rect.height),
  ];
}
