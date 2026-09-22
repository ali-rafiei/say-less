import { useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sfx.ts';

interface Props {
  endsAt: number | null;
  startedAt: number;
  clockOffset: number;
  size?: number;
  showSeconds?: boolean;
}

/** Every timer renders as a shrinking ring driven by the server deadline. */
export function TimerRing({
  endsAt,
  startedAt,
  clockOffset,
  size = 56,
  showSeconds = true,
}: Props) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const lastTick = useRef<number>(-1);
  const arcRef = useRef<SVGCircleElement>(null);
  const circumferenceRef = useRef(0);

  useEffect(() => {
    if (endsAt === null) {
      setSeconds(null);
      return;
    }
    let frame = 0;
    let shownSeconds = -1;
    const total = Math.max(endsAt - startedAt, 1);
    const update = () => {
      const now = Date.now() + clockOffset;
      const remaining = Math.max(endsAt - now, 0);
      const arc = arcRef.current;
      if (arc) {
        arc.style.strokeDashoffset = String(circumferenceRef.current * (1 - remaining / total));
      }
      const secs = Math.ceil(remaining / 1000);
      if (secs !== shownSeconds) {
        shownSeconds = secs;
        setSeconds(secs);
      }
      if (secs <= 5 && secs > 0 && secs !== lastTick.current) {
        lastTick.current = secs;
        sfx.tick();
      }
      if (remaining > 0) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [endsAt, startedAt, clockOffset]);

  if (endsAt === null) return null;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  circumferenceRef.current = circumference;
  const urgent = seconds !== null && seconds <= 5;
  return (
    <div
      className={`ring ${urgent ? 'ring--urgent' : ''}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-live="off"
      aria-label={seconds !== null && seconds <= 10 ? `${seconds} seconds left` : 'time remaining'}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="var(--paper)"
          stroke="var(--ink)"
          strokeWidth={stroke}
        />
        <circle
          ref={arcRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={urgent ? 'var(--danger)' : 'var(--accent)'}
          strokeWidth={stroke - 1}
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showSeconds && <span className="ring__label display">{seconds}</span>}
    </div>
  );
}
