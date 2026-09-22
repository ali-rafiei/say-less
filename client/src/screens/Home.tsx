import { LIMITS } from '@say-less/shared';
import { useState, type FormEvent } from 'react';
import { sfx } from '../audio/sfx.ts';
import { loadName } from '../net/session.ts';
import type { RoomController } from '../net/useRoom.ts';

function codeFromUrl(): string {
  const code = new URLSearchParams(location.search).get('code') ?? '';
  return code
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}

export function Home({ ctl }: { ctl: RoomController }) {
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState(codeFromUrl());
  const [mode, setMode] = useState<'pick' | 'join'>(codeFromUrl() ? 'join' : 'pick');
  const cleanName = name.trim().slice(0, LIMITS.NAME_MAX);
  const canGo = cleanName.length > 0 && ctl.status === 'open';

  if (ctl.rejoining) {
    return (
      <main className="screen center home">
        <Logo />
        <p className="dim">Finding your seat…</p>
      </main>
    );
  }

  function create(event: FormEvent) {
    event.preventDefault();
    if (!canGo) return;
    sfx.tap();
    ctl.createRoom(cleanName);
  }

  function join(event: FormEvent) {
    event.preventDefault();
    if (!canGo || code.length !== 4) return;
    sfx.tap();
    ctl.joinRoom(code, cleanName);
  }

  return (
    <main className="screen home">
      <Logo />
      <p className="center dim tagline">
        Everyone's got something to say. You've got fewer words to say it.
      </p>
      <form className="stack" onSubmit={mode === 'join' ? join : create}>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.NAME_MAX}
          placeholder="Your name"
          autoComplete="nickname"
          aria-label="Your name"
        />
        {mode === 'join' && (
          <input
            className="field field--code"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, '')
                  .slice(0, 4),
              )
            }
            placeholder="CODE"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            inputMode="text"
            aria-label="Room code"
          />
        )}
        {mode === 'pick' ? (
          <>
            <button className="btn btn--block" type="submit" disabled={!canGo}>
              Create Room
            </button>
            <button
              className="btn btn--block btn--secondary"
              type="button"
              onClick={() => setMode('join')}
            >
              Join Room
            </button>
          </>
        ) : (
          <>
            <button className="btn btn--block" type="submit" disabled={!canGo || code.length !== 4}>
              Join
            </button>
            <button
              className="btn btn--block btn--ghost"
              type="button"
              onClick={() => setMode('pick')}
            >
              Back
            </button>
          </>
        )}
      </form>
      <p className="center dim small">3 to 8 players · phones welcome · no account</p>
    </main>
  );
}

export function Logo() {
  return (
    <h1 className="logo display" aria-label="Say Less">
      <span className="logo__say">SAY</span>
      <span className="logo__less">LESS</span>
    </h1>
  );
}
