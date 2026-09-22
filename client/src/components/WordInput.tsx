import { LIMITS, countUnits, validateAnswer, type AnswerMode } from '@say-less/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { sfx } from '../audio/sfx.ts';

interface Props {
  /** Drafts are kept in sessionStorage under this key so a refresh mid-sentence loses nothing. */
  draftKey?: string;
  limit: number;
  mode: AnswerMode;
  onSubmit: (text: string) => void;
  /** Changes whenever the server rejects something; re-enables the form after a failed submit. */
  resetToken?: number | null;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

/** Live counter, soft-blocks typing past the limit, validates like the server. */
function loadDraft(key: string | undefined): string {
  if (!key) return '';
  try {
    return sessionStorage.getItem(`say-less.draft.${key}`) ?? '';
  } catch {
    return '';
  }
}

function storeDraft(key: string | undefined, value: string): void {
  if (!key) return;
  try {
    if (value) sessionStorage.setItem(`say-less.draft.${key}`, value);
    else sessionStorage.removeItem(`say-less.draft.${key}`);
  } catch {
    // storage unavailable: drafts just do not survive a refresh
  }
}

export function WordInput({
  draftKey,
  limit,
  mode,
  onSubmit,
  resetToken,
  disabled,
  autoFocus,
  placeholder,
}: Props) {
  const [pending, setPending] = useState(false);
  useEffect(() => setPending(false), [resetToken]);
  const [value, setValueState] = useState(() => loadDraft(draftKey));
  const setValue = (next: string) => {
    setValueState(next);
    storeDraft(draftKey, next);
  };
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
    if (!validation.ok || disabled || pending) return;
    sfx.tap();
    setPending(true);
    onSubmit(validation.text);
    // The text stays until the server accepts it (the card then unmounts) or rejects it.
  }

  return (
    <form className="winput" onSubmit={handleSubmit}>
      <textarea
        className={`winput__field ${atLimit ? 'winput__field--limit' : ''} ${validation.error === 'invalid_chars' ? 'winput__field--bad' : ''}`}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={(e) => {
          // Keep the field and Submit above the software keyboard.
          setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
        }}
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
        disabled={disabled || pending}
        aria-label="Your answer"
      />
      <div className="winput__bar">
        <span className={`winput__count display ${atLimit ? 'winput__count--limit' : ''}`}>
          {count} / {limit} {unit}
        </span>
        {validation.error === 'invalid_chars' && <span className="winput__hint">emoji only</span>}
        <button
          className="btn btn--small"
          type="submit"
          disabled={!validation.ok || disabled || pending}
        >
          {pending ? 'Sending…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
