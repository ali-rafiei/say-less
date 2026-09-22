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
  const [fraction, setFraction] = useState(1);
  const [seconds, setSeconds] = useState<number | null>(null);
  const lastTick = useRef<number>(-1);

  useEffect(() => {
    if (endsAt === null) {
      setFraction(1);
      setSeconds(null);
      return;
    }
    let frame = 0;
    const total = Math.max(endsAt - startedAt, 1);
    const update = () => {
      const now = Date.now() + clockOffset;
      const remaining = Math.max(endsAt - now, 0);
      setFraction(remaining / total);
      const secs = Math.ceil(remaining / 1000);
      setSeconds(secs);
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
  const urgent = seconds !== null && seconds <= 5;
  return (
    <div
      className={`ring ${urgent ? 'ring--urgent' : ''}`}
      style={{ width: size, height: size }}
      aria-label={`${seconds} seconds left`}
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
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={urgent ? 'var(--danger)' : 'var(--accent)'}
          strokeWidth={stroke - 1}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showSeconds && <span className="ring__label display">{seconds}</span>}
    </div>
  );
}
