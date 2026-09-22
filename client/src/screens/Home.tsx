import { LIMITS } from '@say-less/shared';
import { useEffect, useState, type FormEvent } from 'react';
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
  const [showHelp, setShowHelp] = useState(false);
  const [slowRejoin, setSlowRejoin] = useState(false);
  useEffect(() => {
    if (!ctl.rejoining) return;
    const t = setTimeout(() => setSlowRejoin(true), 5_000);
    return () => clearTimeout(t);
  }, [ctl.rejoining]);
  const cleanName = name.trim().slice(0, LIMITS.NAME_MAX);
  const canGo = cleanName.length > 0 && ctl.status === 'open';

  if (ctl.rejoining) {
    return (
      <main className="screen center home">
        <Logo />
        <p className="dim">Finding your seat…</p>
        {slowRejoin && (
          <button
            className="btn btn--ghost btn--small"
            type="button"
            onClick={() => ctl.startOver()}
          >
            Start over
          </button>
        )}
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
      <button className="btn btn--ghost btn--small" type="button" onClick={() => setShowHelp(true)}>
        How to play
      </button>
      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
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

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-label="How to play" onClick={onClose}>
      <div className="card howto stack" onClick={(e) => e.stopPropagation()}>
        <h2 className="display">How to play</h2>
        <ol className="howto__list">
          <li>
            <b>Gather 3 to 8 people.</b> One creates a room and shares the code; everyone joins on
            their own phone and grabs a character.
          </li>
          <li>
            <b>Answer prompts.</b> Each round you get two absurd prompts. Write the funniest answer
            you can under the word limit: <b>12 words</b>, then <b>6</b>, then <b>3</b>.
          </li>
          <li>
            <b>Vote.</b> Answers to the same prompt face off anonymously. Everyone who didn't write
            them picks the funnier one. 100 points per vote, more in later rounds.
          </li>
          <li>
            <b>Mic Drop.</b> Win with half the word budget or less for a bonus. Sweep every vote for
            a <b>Silenced!</b> bonus.
          </li>
          <li>
            <b>Roast.</b> From round 2, spend your one roast token to cut an opponent to 2 words. If
            they win anyway, they steal your points.
          </li>
          <li>
            <b>Final round.</b> One prompt, 3 words (or 5 emoji), everyone answers, everyone ranks
            their top two. Highest total takes the podium.
          </li>
        </ol>
        <button className="btn btn--block" type="button" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
