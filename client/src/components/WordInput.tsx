import { LIMITS, countUnits, validateAnswer, type AnswerMode } from '@say-less/shared';
import { useState, type FormEvent } from 'react';
import { sfx } from '../audio/sfx.ts';

interface Props {
  limit: number;
  mode: AnswerMode;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

/** Live counter, soft-blocks typing past the limit, validates like the server. */
export function WordInput({ limit, mode, onSubmit, disabled, autoFocus, placeholder }: Props) {
  const [value, setValue] = useState('');
  const count = countUnits(value, mode);
  const validation = validateAnswer(value, limit, mode);
  const atLimit = count >= limit;
  const unit = mode === 'emoji' ? 'emoji' : 'words';

  function handleChange(next: string) {
    if (next.length > LIMITS.MAX_CHARS) return;
    const nextCount = countUnits(next, mode);
    // Extra words don't register: allow deletions and edits that stay within budget.
    if (nextCount > limit && next.length > value.length) {
      sfx.error();
      return;
    }
    setValue(next);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validation.ok || disabled) return;
    sfx.tap();
    onSubmit(validation.text);
    setValue('');
  }

  return (
    <form className="winput" onSubmit={handleSubmit}>
      <textarea
        className={`winput__field ${atLimit ? 'winput__field--limit' : ''} ${validation.error === 'invalid_chars' ? 'winput__field--bad' : ''}`}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        rows={2}
        maxLength={LIMITS.MAX_CHARS}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="on"
        spellCheck
        enterKeyHint="send"
        placeholder={
          placeholder ??
          (mode === 'emoji' ? 'Emoji only. Make it count.' : 'Say it in fewer words…')
        }
        disabled={disabled}
        aria-label="Your answer"
      />
      <div className="winput__bar">
        <span className={`winput__count display ${atLimit ? 'winput__count--limit' : ''}`}>
          {count} / {limit} {unit}
        </span>
        {validation.error === 'invalid_chars' && <span className="winput__hint">emoji only</span>}
        <button className="btn btn--small" type="submit" disabled={!validation.ok || disabled}>
          Submit
        </button>
      </div>
    </form>
  );
}
