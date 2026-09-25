import { UIArt } from '../components/UIArt.tsx';
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
  // A rejected roast (someone got there first) leaves the token unspent: let them pick again.
  useEffect(() => setSpentOn(null), [ctl.error?.at]);
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

  // The server skips players who were gone when the round was dealt; it marks them done.
  const sittingOut = !roastWindow && ctl.prompts.length === 0 && room.submittedIds.includes(me);
  const answeredCount = room.players.filter(
    (p) => p.id === me || room.submittedIds.includes(p.id),
  ).length;

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
            <UIArt name="flame" className="overlay__fire" />
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
            <h2 className="display">
              <UIArt name="flame" /> Roast window
            </h2>
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
              <div
                className={`roast__targets ${room.players.length > 7 ? 'roast__targets--grid' : ''}`}
              >
                {room.players
                  .filter((p) => p.id !== me)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="roast__target"
                      disabled={spentOn !== null}
                      onClick={() => {
                        sfx.roast();
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
        </section>
      )}

      {!roastWindow && ctl.prompts.length === 0 && !sittingOut && (
        <p className="center dim">Dealing prompts…</p>
      )}

      {current && (
        <section className="deck">
          {pending.length > 1 && <div className="card deck__behind" aria-hidden="true" />}
          <div className="card deck__card stack" key={current.promptId}>
            <span className="dim small">
              {ctl.prompts.length - pending.length + 1} of {ctl.prompts.length}
              {current.effectiveLimit === 2 && room.phase === 'WRITING' && (
                <>
                  {' '}
                  · <UIArt name="flame" /> roasted
                </>
              )}
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

      {!current && (ctl.prompts.length > 0 || sittingOut) && (
        <section className="card stack center waitroom">
          <h2 className="display">
            <UIArt name="pencil" /> {answeredCount} of {room.players.length} done
          </h2>
          <div className="pgrid">
            {room.players.map((p) => {
              const done = p.id === me || room.submittedIds.includes(p.id);
              return (
                <PlayerChip
                  key={p.id}
                  player={p}
                  isMe={p.id === me}
                  state={done ? 'waiting' : 'writing'}
                  size={56}
                  badge={done ? 'done' : null}
                />
              );
            })}
          </div>
          {sittingOut && (
            <p>
              You dropped out before the deal, so you sit this round out. You're back in next round.
            </p>
          )}
          <p className="dim small">
            {answeredCount === room.players.length
              ? "Everyone's in. Tallying…"
              : 'Still writing: the ones with pencils.'}
          </p>
        </section>
      )}

      {current && (
        <div className="corner-char">
          <Character
            characterId={myPlayer?.characterId ?? null}
            state={current ? 'writing' : 'idle'}
            size={84}
          />
        </div>
      )}
    </main>
  );
}
