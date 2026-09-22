import { ROUNDS, type PublicRoomState } from '@say-less/shared';
import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { Character } from '../components/Character.tsx';
import { Header } from '../components/Header.tsx';
import { PlayerChip } from '../components/PlayerChip.tsx';
import { TimerRing } from '../components/TimerRing.tsx';
import { WordInput } from '../components/WordInput.tsx';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

export function Writing({ ctl, room, me }: Props) {
  const myPlayer = room.players.find((p) => p.id === me);
  const round = ROUNDS[room.roundIndex]!;
  const pending = ctl.prompts.filter((p) => p.submittedText === null);
  const current = pending[0];
  const roastWindow = room.roastWindowEndsAt !== null;
  const [roastDismissed, setRoastDismissed] = useState(false);
  const [spentOn, setSpentOn] = useState<string | null>(null);

  useEffect(() => setRoastDismissed(false), [ctl.roastedBy]);
  // Forget drafts for prompts the server has accepted.
  useEffect(() => {
    for (const p of ctl.prompts) {
      if (p.submittedText !== null) {
        try {
          sessionStorage.removeItem(`say-less.draft.${room.code}.${p.promptId}`);
        } catch {
          // ignore
        }
      }
    }
  }, [ctl.prompts, room.code]);

  const limit =
    current?.effectiveLimit ?? (room.final?.mode === 'emoji' ? room.final.limit : round.limit);
  const unit = (current?.mode ?? room.final?.mode) === 'emoji' ? 'emoji' : 'words';

  return (
    <main className="screen writing">
      <Header
        room={room}
        clockOffset={ctl.clockOffset}
        limit={limit}
        limitLabel={`${limit} ${unit}`}
      />

      {ctl.roastedBy && !roastDismissed && (
        <div
          className="overlay overlay--roast"
          onClick={() => setRoastDismissed(true)}
          role="dialog"
        >
          <div className="overlay__box">
            <span className="overlay__fire">🔥</span>
            <h2 className="display">YOU'VE BEEN ROASTED</h2>
            <p>
              <b>{ctl.roastedBy}</b> cut you down to <b>2 words</b> on your next answer.
            </p>
            <p className="dim">Good luck.</p>
            <button
              className="btn btn--small"
              type="button"
              autoFocus
              onClick={() => setRoastDismissed(true)}
            >
              Fine.
            </button>
          </div>
        </div>
      )}

      {roastWindow && (
        <section className="card stack roast">
          <div className="row row--between">
            <h2 className="display">🔥 Roast window</h2>
            <TimerRing
              endsAt={room.roastWindowEndsAt}
              startedAt={(room.roastWindowEndsAt ?? 0) - 10_000}
              clockOffset={ctl.clockOffset}
              size={44}
            />
          </div>
          <p className="dim small">Prompts arrive when the window closes.</p>
          {ctl.myRoastTokens > 0 ? (
            <>
              <p>
                Spend your one roast token: their next answer gets <b>2 words</b>. If they win
                anyway, they steal your points.
              </p>
              <div className="roast__targets">
                {room.players
                  .filter((p) => p.id !== me)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="roast__target"
                      disabled={spentOn !== null}
                      onClick={() => {
                        sfx.tap();
                        setSpentOn(p.id);
                        ctl.spendRoast(p.id);
                      }}
                    >
                      <Character characterId={p.characterId} size={44} />
                      <span>{p.name}</span>
                      <span className="roast__cta display">ROAST</span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <p className="dim">
              {spentOn
                ? 'Token spent. Brace yourself.'
                : 'No token left. Hope nobody remembers you.'}
            </p>
          )}
          <p className="dim small">Prompts arrive when the window closes.</p>
        </section>
      )}

      {!roastWindow && ctl.prompts.length === 0 && <p className="center dim">Dealing prompts…</p>}

      {current && (
        <section className="deck">
          {pending.length > 1 && <div className="card deck__behind" aria-hidden="true" />}
          <div className="card deck__card stack" key={current.promptId}>
            <span className="dim small">
              {ctl.prompts.length - pending.length + 1} of {ctl.prompts.length}
              {current.effectiveLimit === 2 && room.phase === 'WRITING' ? ' · 🔥 roasted' : ''}
            </span>
            <h2 className="prompt display">{current.text}</h2>
            <WordInput
              key={current.promptId}
              draftKey={`${room.code}.${current.promptId}`}
              limit={current.effectiveLimit}
              mode={current.mode}
              resetToken={ctl.error?.at ?? null}
              autoFocus
              onSubmit={(text) => ctl.submitAnswer(current.promptId, text)}
            />
          </div>
        </section>
      )}

      {!current && ctl.prompts.length > 0 && (
        <section className="card stack center">
          <h2 className="display">Waiting on…</h2>
          <div className="pgrid">
            {room.players
              .filter((p) => !room.submittedIds.includes(p.id) && p.id !== me)
              .map((p) => (
                <PlayerChip key={p.id} player={p} state="writing" size={56} />
              ))}
            {room.players.filter((p) => !room.submittedIds.includes(p.id) && p.id !== me).length ===
              0 && <p className="dim">Everyone's in. Tallying…</p>}
          </div>
        </section>
      )}

      <div className="corner-char">
        <Character
          characterId={myPlayer?.characterId ?? null}
          state={current ? 'writing' : 'idle'}
          size={84}
        />
      </div>
    </main>
  );
}
