import { characterMeta, type PublicMatchup, type PublicRoomState } from '@say-less/shared';
import { useEffect } from 'react';
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

function stampsFor(matchup: PublicMatchup, playerId: string | null): string[] {
  if (!matchup.result || !playerId) return [];
  const stamps: string[] = [];
  for (const award of matchup.result.awards) {
    if (award.playerId !== playerId) continue;
    if (award.kind === 'silenced') stamps.push('SILENCED!');
    if (award.kind === 'micDrop') stamps.push('MIC DROP!');
    if (award.kind === 'greatMinds') stamps.push('GREAT MINDS');
    if (award.kind === 'steal') stamps.push('BACKFIRE!');
    if (award.kind === 'stolen') stamps.push('ROBBED');
  }
  return stamps;
}

export function MatchupReveal({ ctl, room, me }: Props) {
  const matchup = room.matchups[room.currentMatchupIndex];
  const result = matchup?.result;
  const micDropper = result?.awards.find((a) => a.kind === 'micDrop')?.playerId ?? null;
  const micDropCharacter = room.players.find((p) => p.id === micDropper)?.characterId ?? null;

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      if (micDropper) sfx.micDrop();
      else if (result.winnerIndex !== null) sfx.win();
    }, 1200);
    return () => clearTimeout(t);
  }, [result, micDropper]);

  if (!matchup || !result) return null;
  const total = result.voteCounts[0] + result.voteCounts[1];

  return (
    <main className="screen reveal">
      <Header room={room} clockOffset={ctl.clockOffset} />
      <h2 className="prompt display center">{matchup.promptText}</h2>
      {result.greatMinds && <div className="banner stamp-banner display">GREAT MINDS</div>}

      <div className="rcards">
        {matchup.answers.map((answer, index) => {
          const player = room.players.find((p) => p.id === answer.playerId);
          const meta = characterMeta(player?.characterId);
          const won = result.winnerIndex === index;
          const lost = result.winnerIndex !== null && !won;
          const state = won ? 'win' : lost ? 'lose' : 'idle';
          const delta = answer.playerId ? (result.delta[answer.playerId] ?? 0) : 0;
          const share = total === 0 ? 0 : result.voteCounts[index]! / total;
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
                  size={72}
                  className="rcard__char"
                />
                <span className="rcard__name display" style={{ background: meta?.accent }}>
                  {player?.name ?? '?'}
                  {player?.id === me ? ' (you)' : ''}
                </span>
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
              <div className="row row--wrap voters">
                {voters.map((v) => (
                  <Character key={v.id} characterId={v.characterId} size={28} />
                ))}
              </div>
              <div className="rcard__points display">
                {delta >= 0 ? '+' : ''}
                {delta}
              </div>
              <div className="stamps">
                {stampsFor(matchup, answer.playerId).map((s, i) => (
                  <span
                    key={s}
                    className={`stamp display stamp--${s.replace(/[^A-Z]/g, '').toLowerCase()}`}
                    style={{ animationDelay: `${1.4 + i * 0.3}s` }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {matchup.roast && (
        <p className="center dim small">
          🔥 {room.players.find((p) => p.id === matchup.roast!.spenderId)?.name} roasted{' '}
          {room.players.find((p) => p.id === matchup.roast!.targetId)?.name} down to 2 words.
        </p>
      )}

      {micDropper && (
        <div className="micdrop-overlay" aria-hidden="true">
          <Character characterId={micDropCharacter} state="win" size={220} />
          <span className="micdrop-stamp">MIC DROP</span>
        </div>
      )}
    </main>
  );
}
