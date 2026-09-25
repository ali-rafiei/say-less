import { characterMeta, type PublicRoomState } from '@say-less/shared';
import { useEffect } from 'react';
import { Character } from '../components/Character.tsx';
import { Header } from '../components/Header.tsx';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

export function RoundResults({ ctl, room, me }: Props) {
  const roundDelta = new Map<string, number>();
  for (const m of room.matchups) {
    for (const [id, d] of Object.entries(m.result?.delta ?? {}))
      roundDelta.set(id, (roundDelta.get(id) ?? 0) + d);
  }
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  const bottom = sorted[sorted.length - 1]?.score ?? 0;
  const dense = sorted.length > 8;

  // With twelve rows, the lower half of the board is below the fold for the 8 s it shows.
  useEffect(() => {
    const t = setTimeout(() => {
      document
        .querySelector('.board__row--me')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="screen results">
      <Header room={room} clockOffset={ctl.clockOffset} />
      <h2 className="display center">Scoreboard</h2>
      <ol className={`board ${dense ? 'board--dense' : ''}`}>
        {sorted.map((p, i) => {
          const delta = roundDelta.get(p.id) ?? 0;
          const state =
            p.score === top && top > 0
              ? 'win'
              : p.score === bottom && sorted.length > 1 && top !== bottom
                ? 'lose'
                : 'idle';
          return (
            <li
              key={p.id}
              className={`board__row ${p.id === me ? 'board__row--me' : ''}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="board__rank display">{i + 1}</span>
              <Character characterId={p.characterId} state={state} size={dense ? 36 : 52} />
              <span
                className="board__name"
                style={{ background: characterMeta(p.characterId)?.accent }}
              >
                {p.name}
              </span>
              <span
                className={`board__delta ${delta > 0 ? 'board__delta--up' : delta < 0 ? 'board__delta--down' : ''}`}
              >
                {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : '–'}
              </span>
              <span className="board__score display">{p.score}</span>
            </li>
          );
        })}
      </ol>
      <p className="center dim">
        {room.roundIndex < 2 ? 'Next round in a moment…' : 'Final round next…'}
      </p>
    </main>
  );
}
