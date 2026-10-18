import { TIMERS } from '@say-less/shared';
import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';

interface Props {
  endsAt: number | null;
  clockOffset: number;
  /** only people who still owe an answer get the nudge */
  active: boolean;
}

/** A one-time nudge when the clock is nearly out. */
export function HurryUp({ endsAt, clockOffset, active }: Props) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false);
    if (endsAt === null || !active) return;
    const wait = endsAt - TIMERS.HURRY_UP_MS - (Date.now() + clockOffset);
    if (wait < -TIMERS.HURRY_UP_MS / 2) return;
    const t = setTimeout(
      () => {
        setShow(true);
        sfx.tick();
      },
      Math.max(wait, 0),
    );
    return () => clearTimeout(t);
  }, [endsAt, clockOffset, active]);
  if (!show || !active) return null;
  return (
    <div className="hurry display" role="status">
      {Math.round(TIMERS.HURRY_UP_MS / 1000)} seconds left!
    </div>
  );
}
