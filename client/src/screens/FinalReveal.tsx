import { UIArt } from '../components/UIArt.tsx';
import { characterMeta, finalRevealSchedule, type PublicRoomState } from '@say-less/shared';
import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { AnswerText } from '../components/AnswerText.tsx';
import { Character } from '../components/Character.tsx';
import { Header } from '../components/Header.tsx';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

/** Final answers one at a time, fewest points first, so the winner lands last. */
export function FinalReveal({ ctl, room, me }: Props) {
  const final = room.final;
  const now = useServerNow(ctl.clockOffset);
  const result = final?.result ?? {};
  const pointsOf = (playerId: string | null) => (playerId ? (result[playerId]?.points ?? 0) : 0);
  const order = [...(final?.answers ?? [])].sort(
    (a, b) => pointsOf(a.playerId) - pointsOf(b.playerId),
  );
  const { starts } = finalRevealSchedule(order.length);
  const shown = starts.filter((start) => now - room.phaseStartedAt >= start).length;
  const current = shown > 0 ? order[shown - 1] : undefined;
  const isWinner = shown === order.length && order.length > 0;

  useEffect(() => {
    if (shown === 0) return;
    if (shown === order.length) sfx.micDrop();
    else if (pointsOf(order[shown - 1]?.playerId ?? null) === 0) sfx.lose();
    else sfx.win();
    // Keyed on the count alone: only a newly revealed answer plays a sound.
  }, [shown]);

  if (!final) return null;
  const player = room.players.find((p) => p.id === current?.playerId);
  const tally = current?.playerId ? result[current.playerId] : undefined;
  const place = order.length - shown + 1;

  return (
    <main className="screen freveal">
      <Header room={room} clockOffset={ctl.clockOffset} />
      <h2 className="prompt display center">{final.prompt.text}</h2>

      {!current ? (
        <p className="freveal__wait display center">The votes are in…</p>
      ) : (
        <section
          key={current.playerId}
          className={`card fspot ${isWinner ? 'fspot--winner' : ''}`}
          aria-live="polite"
        >
          <span className="fspot__place display">
            {isWinner ? (
              <>
                <UIArt name="crown" /> Best answer
              </>
            ) : (
              `#${place}`
            )}
          </span>
          <AnswerText
            text={current.text ?? '…'}
            filter={room.settings.profanityFilter && current.playerId !== me}
            className="fspot__text"
          />
          <div className="fspot__who">
            <Character
              characterId={player?.characterId ?? null}
              state={isWinner ? 'win' : pointsOf(current.playerId) === 0 ? 'lose' : 'idle'}
              size={isWinner ? 120 : 84}
            />
            <span
              className="fspot__name display"
              style={{ background: characterMeta(player?.characterId)?.accent }}
            >
              {player?.name ?? '?'}
            </span>
          </div>
          <span className="fspot__tally dim">
            {tally?.first ?? 0}× 1st · {tally?.second ?? 0}× 2nd
          </span>
          <span className="fspot__pts display">+{tally?.points ?? 0}</span>
        </section>
      )}

      {shown > 1 && (
        <section className="card stack fsofar">
          {order
            .slice(0, shown - 1)
            .reverse()
            .map((answer) => {
              const author = room.players.find((p) => p.id === answer.playerId);
              return (
                <div key={answer.playerId} className="fanswer row">
                  <Character characterId={author?.characterId ?? null} size={36} />
                  <AnswerText
                    text={answer.text ?? '…'}
                    compact
                    filter={room.settings.profanityFilter && answer.playerId !== me}
                    className="grow"
                  />
                  <span className="display fanswer__pts">+{pointsOf(answer.playerId)}</span>
                </div>
              );
            })}
        </section>
      )}
    </main>
  );
}

/** Server clock, re-read a few times a second so the reveal follows the shared schedule. */
function useServerNow(clockOffset: number): number {
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + clockOffset), 200);
    return () => clearInterval(timer);
  }, [clockOffset]);
  return now;
}
