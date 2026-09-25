import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { maskProfanity } from './profanity.ts';

interface Props {
  text: string;
  /** Smaller type for grids of many answers (the final-round wall). */
  compact?: boolean;
  /** Mask profanity for everyone but the author (author sees their own text). */
  filter?: boolean;
  typewriter?: boolean;
  className?: string;
}

function fontSizeFor(text: string, compact: boolean): string {
  const n = text.length;
  if (compact) return n <= 14 ? 'clamp(22px, 6vw, 30px)' : 'clamp(17px, 4.6vw, 24px)';
  if (n <= 10) return 'clamp(34px, 10vw, 52px)';
  if (n <= 24) return 'clamp(28px, 8vw, 44px)';
  if (n <= 48) return 'clamp(24px, 6.4vw, 36px)';
  if (n <= 80) return 'clamp(20px, 5.4vw, 30px)';
  return 'clamp(17px, 4.6vw, 24px)';
}

/** Answers always render in the display font at the largest size that fits. */
export function AnswerText({
  text,
  compact = false,
  filter = false,
  typewriter = false,
  className = '',
}: Props) {
  const shown = filter ? maskProfanity(text) : text;
  const [visible, setVisible] = useState(typewriter ? 0 : shown.length);

  useEffect(() => {
    if (!typewriter) {
      setVisible(shown.length);
      return;
    }
    setVisible(0);
    const chars = Array.from(shown);
    // Shorter answers type slower per character so a 2-word answer lands with weight.
    const perChar = Math.min(Math.max(1100 / Math.max(chars.length, 1), 28), 140);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setVisible(i);
      if (chars[i - 1] && chars[i - 1] !== ' ') sfx.typewriter();
      if (i >= chars.length) clearInterval(timer);
    }, perChar);
    return () => clearInterval(timer);
  }, [shown, typewriter]);

  const chars = Array.from(shown);
  return (
    <span
      className={`answer-text display ${className}`}
      style={{ fontSize: fontSizeFor(shown, compact) }}
    >
      {chars.slice(0, visible).join('')}
      {typewriter && visible < chars.length && <span className="caret">▍</span>}
    </span>
  );
}
