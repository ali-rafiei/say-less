import type { PublicRoomState } from '@say-less/shared';
import { sfx } from '../audio/sfx.ts';
import { AnswerText } from '../components/AnswerText.tsx';
import { Character } from '../components/Character.tsx';
import { ConfirmButton } from '../components/ConfirmButton.tsx';
import { Header } from '../components/Header.tsx';
import { LetterTiles } from '../components/LetterTiles.tsx';
import { SeedView } from '../components/SeedView.tsx';
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
  const watching = room.viewer.role === 'audience';
  const canCensor = room.leaderId === me && !isAuthor;

  return (
    <main className="screen voting">
      <Header ctl={ctl} room={room} />
      <span className="center dim">
        Matchup {room.currentMatchupIndex + 1} of {room.matchups.length}
      </span>
      {matchup.seed && <SeedView seed={matchup.seed} room={room} drawings={ctl.drawings} me={me} />}
      <h2 className="prompt display center">{matchup.promptText}</h2>
      {matchup.letters && <LetterTiles letters={matchup.letters} />}

      <div className="vcards">
        {matchup.answers.map((answer, index) => (
          <div key={index} className="vslot">
            <button
              type="button"
              className={`card vcard ${voted || isAuthor || answer.censored ? 'vcard--locked' : ''}`}
              disabled={voted || isAuthor || answer.censored}
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
            {canCensor && !answer.censored && (
              <ConfirmButton
                label="Censor"
                confirmLabel="Censor this answer?"
                className="censor"
                ariaLabel={`Censor answer ${index === 0 ? 'A' : 'B'}`}
                onConfirm={() => ctl.censorAnswer(room.currentMatchupIndex, index as 0 | 1)}
              />
            )}
          </div>
        ))}
      </div>

      {isAuthor ? (
        <div className="center stack">
          <Character characterId={myPlayer?.characterId ?? null} state="waiting" size={96} />
          <p className="dim">You wrote one of these. Sweat it out.</p>
        </div>
      ) : voted ? (
        <p className="center dim">
          {watching
            ? 'Vote in. The players decide the winner; you decide the Crowd Favourite.'
            : 'Vote locked. Waiting on the other voters…'}
        </p>
      ) : (
        <p className="center dim">
          {watching ? 'Audience vote: tap the funnier one.' : 'Tap the funnier one.'}
        </p>
      )}
    </main>
  );
}
