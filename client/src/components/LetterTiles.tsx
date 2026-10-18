import { initialsMatched } from '@say-less/shared';

interface Props {
  letters: string;
  /** the draft so far; tiles light up as words match */
  text?: string;
  size?: 'small' | 'large';
}

/** Initials mode: the letters an answer must start with, in order. */
export function LetterTiles({ letters, text, size = 'small' }: Props) {
  const matched = text === undefined ? null : initialsMatched(text, letters);
  return (
    <div
      className={`letters letters--${size}`}
      role="img"
      aria-label={`Initials: ${Array.from(letters).join(' ')}`}
    >
      {Array.from(letters).map((letter, i) => (
        <span
          key={i}
          className={`letter display ${matched?.[i] ? 'letter--hit' : ''}`}
          aria-hidden="true"
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
