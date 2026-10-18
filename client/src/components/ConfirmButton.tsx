import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';

interface Props {
  label: string;
  /** shown after the first tap; a second tap within a few seconds confirms */
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Two taps for anything that cannot be undone (Bail Out, censor, kick). */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'btn btn--small btn--secondary',
  disabled,
  ariaLabel,
}: Props) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4_000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className} ${armed ? 'confirm--armed' : ''}`}
      disabled={disabled}
      aria-label={armed ? confirmLabel : (ariaLabel ?? label)}
      onClick={(event) => {
        event.stopPropagation();
        sfx.tap();
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
