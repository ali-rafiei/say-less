import type { PublicRoomState } from '@say-less/shared';
import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { AnswerText } from '../components/AnswerText.tsx';
import { ConfirmButton } from '../components/ConfirmButton.tsx';
import { Header } from '../components/Header.tsx';
import { LetterTiles } from '../components/LetterTiles.tsx';
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
  // Out of Context and the audience vote once; players rank two in the final. Every wall
  // answer carries the id it is voted with (a post id, a player id, or an anonymous id).
  const watching = room.viewer.role === 'audience';
  const posts = final.voting === 'single';
  const single = posts || watching;
  const need = single ? 1 : 2;
  const isLeader = room.leaderId === me;
  const idOf = (answer: (typeof final.answers)[number]) => answer.answerId;
  const isMine = (answer: (typeof final.answers)[number]) =>
    answer.answerId !== null && answer.answerId === room.viewer.finalAnswerId;
  const canVoteAtAll = final.answers.filter((a) => !isMine(a) && !a.censored).length >= need;

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
      <Header ctl={ctl} room={room} />
      {final.seed && <SeedView seed={final.seed} room={room} drawings={ctl.drawings} me={me} />}
      {posts ? (
        <h2 className="prompt display center">Which post looks the most ridiculous?</h2>
      ) : (
        <h2 className="prompt display center">{final.prompt.text}</h2>
      )}
      {final.letters && <LetterTiles letters={final.letters} />}
      <p className="center dim">
        {watching
          ? 'Audience vote: pick your favourite. It wins the Crowd Favourite bonus.'
          : single
            ? 'One vote. Not the one you twisted.'
            : 'Pick your top two, in order. Not yourself.'}
      </p>
      <div className={`wall ${posts ? 'wall--posts' : ''}`}>
        {final.answers.map((answer) => {
          const id = idOf(answer);
          const mine = isMine(answer);
          const rank = picks.indexOf(id ?? '');
          return (
            <div key={id ?? answer.text} className="wslot">
              <button
                type="button"
                className={`card wcard ${mine ? 'wcard--mine' : ''} ${rank >= 0 ? 'wcard--picked' : ''}`}
                disabled={mine || voted || answer.censored}
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
              {isLeader && !mine && !answer.censored && id && (
                <ConfirmButton
                  label="Censor"
                  confirmLabel="Censor it?"
                  className="censor"
                  onConfirm={() => {
                    setPicks((current) => current.filter((x) => x !== id));
                    ctl.censorFinal(id);
                  }}
                />
              )}
            </div>
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
