import type { PublicRoomState } from '@say-less/shared';
import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { AnswerText } from '../components/AnswerText.tsx';
import { Header } from '../components/Header.tsx';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

export function FinalVoting({ ctl, room, me }: Props) {
  const final = room.final;
  const [picks, setPicks] = useState<string[]>([]);
  const voted = room.votedIds.includes(me);
  const promptId = final?.prompt.id;
  useEffect(() => setPicks([]), [promptId]);
  if (!final) return null;
  const canVoteAtAll = final.answers.filter((a) => a.playerId !== me).length >= 2;

  function toggle(playerId: string) {
    if (voted || playerId === me) return;
    sfx.tap();
    setPicks((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : current.length < 2
          ? [...current, playerId]
          : current,
    );
  }

  return (
    <main className="screen screen--wide final">
      <Header room={room} clockOffset={ctl.clockOffset} />
      <h2 className="prompt display center">{final.prompt.text}</h2>
      <p className="center dim">Pick your top two, in order. Not yourself.</p>
      <div className="wall">
        {final.answers.map((answer) => {
          const mine = answer.playerId === me;
          const rank = picks.indexOf(answer.playerId ?? '');
          return (
            <button
              key={answer.playerId ?? answer.text}
              type="button"
              className={`card wcard ${mine ? 'wcard--mine' : ''} ${rank >= 0 ? 'wcard--picked' : ''}`}
              disabled={mine || voted}
              onClick={() => answer.playerId && toggle(answer.playerId)}
            >
              {rank >= 0 && <span className="wcard__rank display">{rank + 1}</span>}
              <AnswerText
                text={answer.text ?? '…'}
                compact
                filter={room.settings.profanityFilter && !mine}
              />
            </button>
          );
        })}
      </div>
      <div className="startbar">
        {voted ? (
          <p className="startbar__wait">Votes locked. Waiting on the others…</p>
        ) : canVoteAtAll ? (
          <button
            className="btn btn--block"
            type="button"
            disabled={picks.length !== 2}
            onClick={() => {
              sfx.tap();
              ctl.castFinalVotes(picks[0]!, picks[1]!);
            }}
          >
            {picks.length === 2 ? 'Lock in' : `Pick ${2 - picks.length} more`}
          </button>
        ) : (
          <p className="startbar__wait">Not enough other answers to vote on.</p>
        )}
      </div>
    </main>
  );
}
