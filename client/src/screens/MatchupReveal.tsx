import { UIArt } from '../components/UIArt.tsx';
import {
  characterMeta,
  type PublicAnswer,
  type PublicMatchup,
  type PublicRoomState,
} from '@say-less/shared';
import { useEffect } from 'react';
import { sfx } from '../audio/sfx.ts';
import { AnswerText } from '../components/AnswerText.tsx';
import { Character } from '../components/Character.tsx';
import { Header } from '../components/Header.tsx';
import { LetterTiles } from '../components/LetterTiles.tsx';
import { SeedView } from '../components/SeedView.tsx';
import type { RoomController } from '../net/useRoom.ts';

/** Text tags under a revealed answer; the modifier picks the colour. */
interface Tag {
  label: string;
  modifier: 'backfire' | 'robbed' | 'crowd' | 'random';
}

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

function tagsFor(matchup: PublicMatchup, answer: PublicAnswer): Tag[] {
  const tags: Tag[] = [];
  if (answer.bailOut) tags.push({ label: 'Random answer', modifier: 'random' });
  for (const award of matchup.result?.awards ?? []) {
    if (award.playerId !== answer.playerId) continue;
    if (award.kind === 'steal') tags.push({ label: 'BACKFIRE!', modifier: 'backfire' });
    if (award.kind === 'stolen') tags.push({ label: 'ROBBED', modifier: 'robbed' });
    if (award.kind === 'crowd') tags.push({ label: 'CROWD FAVOURITE', modifier: 'crowd' });
  }
  return tags;
}

export function MatchupReveal({ ctl, room, me }: Props) {
  const matchup = room.matchups[room.currentMatchupIndex];
  const result = matchup?.result;

  const myIndex = matchup?.answers.findIndex((a) => a.playerId === me) ?? -1;
  const iLost = result?.winnerIndex != null && myIndex >= 0 && result.winnerIndex !== myIndex;
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      if (iLost) sfx.lose();
      else if (result.winnerIndex !== null) sfx.win();
    }, 1200);
    return () => clearTimeout(t);
  }, [result, iLost]);

  if (!matchup || !result) return null;
  const total = result.voteCounts[0] + result.voteCounts[1];

  return (
    <main className="screen reveal">
      <Header ctl={ctl} room={room} />
      {matchup.seed && <SeedView seed={matchup.seed} room={room} drawings={ctl.drawings} me={me} />}
      <h2 className="prompt display center">{matchup.promptText}</h2>
      {matchup.letters && <LetterTiles letters={matchup.letters} />}
      {result.greatMinds && <div className="tag-banner display">GREAT MINDS</div>}

      <div className="rcards">
        {matchup.answers.map((answer, index) => {
          const player = room.players.find((p) => p.id === answer.playerId);
          const meta = characterMeta(player?.characterId);
          const won = result.winnerIndex === index;
          const lost = result.winnerIndex !== null && !won;
          const state = won ? 'win' : lost ? 'lose' : 'idle';
          const delta = answer.playerId ? (result.delta[answer.playerId] ?? 0) : 0;
          const share = total === 0 ? 0 : result.voteCounts[index]! / total;
          const tags = tagsFor(matchup, answer);
          const voters = Object.entries(matchup.votes ?? {})
            .filter(([, choice]) => choice === index)
            .map(([voterId]) => room.players.find((p) => p.id === voterId))
            .filter((p) => p !== undefined);
          return (
            <div
              key={index}
              className={`card rcard ${won ? 'rcard--won' : ''} ${lost ? 'rcard--lost' : ''}`}
            >
              <div className="rcard__who">
                <Character
                  characterId={player?.characterId ?? null}
                  state={state}
                  size={76}
                  className="rcard__char"
                />
                <span className="rcard__name display" style={{ background: meta?.accent }}>
                  {player?.name ?? '?'}
                </span>
                <div className="stamps">
                  {tags.map((tag, i) => (
                    <span
                      key={tag.label}
                      className={`tag tag--${tag.modifier} display`}
                      style={{ animationDelay: `${1.4 + i * 0.3}s` }}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
              <AnswerText
                text={answer.text ?? '…'}
                typewriter
                filter={room.settings.profanityFilter && answer.playerId !== me}
              />
              <div className="vbar">
                <div
                  className="vbar__fill"
                  style={{ width: `${Math.round(share * 100)}%`, background: meta?.accent }}
                />
                <span className="vbar__count display">
                  {result.voteCounts[index]} {result.voteCounts[index] === 1 ? 'vote' : 'votes'}
                </span>
              </div>
              <div className="rcard__foot">
                <div className={`row row--wrap voters ${voters.length > 5 ? 'voters--many' : ''}`}>
                  {voters.map((v) => (
                    <Character key={v.id} characterId={v.characterId} size={26} />
                  ))}
                </div>
                <div className="rcard__points display">
                  {delta >= 0 ? '+' : ''}
                  {delta}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {result.audienceCounts[0] + result.audienceCounts[1] > 0 && (
        <p className="center dim small">
          Audience: A {result.audienceCounts[0]} · B {result.audienceCounts[1]}
        </p>
      )}

      {matchup.roast && (
        <p className="center dim small">
          <UIArt name="flame" /> {room.players.find((p) => p.id === matchup.roast!.spenderId)?.name}{' '}
          roasted {room.players.find((p) => p.id === matchup.roast!.targetId)?.name} down to 2
          words.
        </p>
      )}
    </main>
  );
}
