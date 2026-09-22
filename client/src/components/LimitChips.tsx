import { useEffect, useState } from 'react';

interface Props {
  limit: number;
  /** When set, tiles above `limit` (up to this count) render and shatter away. */
  shatterFrom?: number | undefined;
  label?: string;
  size?: 'small' | 'large';
}

/** The word budget as physical tiles: the signature motif. */
export function LimitChips({ limit, shatterFrom, label, size = 'small' }: Props) {
  const total = Math.max(limit, shatterFrom ?? 0);
  const [shattering, setShattering] = useState(false);
  useEffect(() => {
    if (shatterFrom === undefined || shatterFrom <= limit) return;
    const t = setTimeout(() => setShattering(true), 900);
    return () => clearTimeout(t);
  }, [shatterFrom, limit]);
  return (
    <div className={`chips chips--${size}`} role="img" aria-label={label ?? `${limit} words`}>
      {Array.from({ length: total }, (_, i) => {
        const doomed = i >= limit;
        return (
          <span
            key={i}
            className={`chip ${doomed ? 'chip--doomed' : ''} ${doomed && shattering ? 'chip--shatter' : ''}`}
            style={{ animationDelay: doomed ? `${(i - limit) * 40}ms` : undefined }}
          />
        );
      })}
      {label && <span className="chips__label display">{label}</span>}
    </div>
  );
}
