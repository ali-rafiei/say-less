import type { PublicRoomState } from '@say-less/shared';
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

export function Voting({ ctl, room, me }: Props) {
  const matchup = room.matchups[room.currentMatchupIndex];
  if (!matchup) return null;
  const isAuthor = matchup.promptId in ctl.myPrompts;
  const myText = ctl.myPrompts[matchup.promptId] ?? null;
  const voted = room.votedIds.includes(me);
  const myPlayer = room.players.find((p) => p.id === me);

  return (
    <main className="screen voting">
      <Header room={room} clockOffset={ctl.clockOffset} />
      <span className="center dim">
        Matchup {room.currentMatchupIndex + 1} of {room.matchups.length}
      </span>
      <h2 className="prompt display center">{matchup.promptText}</h2>

      <div className="vcards">
        {matchup.answers.map((answer, index) => (
          <button
            key={index}
            type="button"
            className={`card vcard ${voted || isAuthor ? 'vcard--locked' : ''}`}
            disabled={voted || isAuthor}
            onClick={() => {
              sfx.tap();
              ctl.castVote(room.currentMatchupIndex, index as 0 | 1);
            }}
          >
            <span className="vcard__letter display">{index === 0 ? 'A' : 'B'}</span>
            <AnswerText
              text={answer.text ?? '…'}
              filter={room.settings.profanityFilter && answer.text !== myText}
            />
          </button>
        ))}
      </div>

      {isAuthor ? (
        <div className="center stack">
          <Character characterId={myPlayer?.characterId ?? null} state="waiting" size={96} />
          <p className="dim">You wrote one of these. Sweat it out.</p>
        </div>
      ) : voted ? (
        <p className="center dim">Vote locked. Waiting on the other voters…</p>
      ) : (
        <p className="center dim">Tap the funnier one.</p>
      )}
    </main>
  );
}
