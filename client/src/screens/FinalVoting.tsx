import type { PublicRoomState } from '@say-less/shared';
import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { AnswerText } from '../components/AnswerText.tsx';
import { Header } from '../components/Header.tsx';
import { PostView, SeedView } from '../components/SeedView.tsx';
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
  // Out of Context votes once, by post id (twisters stay hidden); the final ranks two players.
  const single = final.voting === 'single';
  const need = single ? 1 : 2;
  const idOf = (answer: (typeof final.answers)[number]) =>
    single ? (answer.seed?.kind === 'post' ? answer.seed.postId : null) : answer.playerId;
  const isMine = (answer: (typeof final.answers)[number]) =>
    single ? (idOf(answer) ?? '') in ctl.myPrompts : answer.playerId === me;
  const canVoteAtAll = final.answers.filter((a) => !isMine(a)).length >= need;

  function toggle(id: string) {
    if (voted) return;
    sfx.tap();
    setPicks((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : single
          ? [id]
          : current.length < 2
            ? [...current, id]
            : current,
    );
  }

  return (
    <main className="screen screen--wide final">
      <Header room={room} clockOffset={ctl.clockOffset} />
      {final.seed && <SeedView seed={final.seed} room={room} drawings={ctl.drawings} me={me} />}
      {single ? (
        <h2 className="prompt display center">Which post looks the most ridiculous?</h2>
      ) : (
        <h2 className="prompt display center">{final.prompt.text}</h2>
      )}
      <p className="center dim">
        {single
          ? 'One vote. Not the one you twisted.'
          : 'Pick your top two, in order. Not yourself.'}
      </p>
      <div className={`wall ${single ? 'wall--posts' : ''}`}>
        {final.answers.map((answer) => {
          const id = idOf(answer);
          const mine = isMine(answer);
          const rank = picks.indexOf(id ?? '');
          return (
            <button
              key={id ?? answer.text}
              type="button"
              className={`card wcard ${mine ? 'wcard--mine' : ''} ${rank >= 0 ? 'wcard--picked' : ''}`}
              disabled={mine || voted}
              onClick={() => id && toggle(id)}
            >
              {rank >= 0 && !single && <span className="wcard__rank display">{rank + 1}</span>}
              {answer.seed?.kind === 'post' ? (
                <PostView seed={answer.seed} room={room} me={me} twist={answer.text ?? '…'} />
              ) : (
                <AnswerText
                  text={answer.text ?? '…'}
                  compact
                  filter={room.settings.profanityFilter && !mine}
                />
              )}
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
            disabled={picks.length !== need}
            onClick={() => {
              sfx.tap();
              ctl.castFinalVotes(picks[0]!, picks[1] ?? '');
            }}
          >
            {picks.length === need
              ? 'Lock in'
              : single
                ? 'Pick one'
                : `Pick ${2 - picks.length} more`}
          </button>
        ) : (
          <p className="startbar__wait">Not enough other answers to vote on.</p>
        )}
      </div>
    </main>
  );
}
