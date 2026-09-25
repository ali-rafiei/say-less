import { UIArt } from '../components/UIArt.tsx';
import { characterMeta, type PublicRoomState } from '@say-less/shared';
import { sfx } from '../audio/sfx.ts';
import { AnswerText } from '../components/AnswerText.tsx';
import { Character } from '../components/Character.tsx';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

export function Podium({ ctl, room, me }: Props) {
  const podium = room.podium;
  const isLeader = room.leaderId === me;
  const byId = new Map(room.players.map((p) => [p.id, p]));
  const placements = podium?.placements ?? [];
  const top3 = placements.filter((p) => p.place <= 3);
  const columns = [2, 1, 3].map((place) => top3.filter((p) => p.place === place));
  const final = room.final;

  return (
    <main className="screen screen--wide podium">
      <h1 className="display center podium__title">Podium</h1>
      <div className="blocks">
        {columns.map((group, i) => {
          const place = [2, 1, 3][i]!;
          return (
            <div key={place} className={`block block--${place}`}>
              <div className="block__chars">
                {group.map((p) => {
                  const player = byId.get(p.playerId);
                  return (
                    <div key={p.playerId} className="block__who">
                      <Character
                        characterId={player?.characterId ?? null}
                        state={place === 1 ? 'win' : place === 3 ? 'lose' : 'idle'}
                        size={place === 1 ? 110 : 84}
                      />
                      <span
                        className="block__name display"
                        style={{ background: characterMeta(player?.characterId)?.accent }}
                      >
                        {place === 1 && <UIArt name="crown" />}
                        {player?.name ?? '?'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="block__stand display">
                <UIArt
                  name={place === 1 ? 'stand-1' : place === 2 ? 'stand-2' : 'stand-3'}
                  label={`Place ${place}`}
                  className="block__art"
                />
                <span className="block__score">{group[0]?.score ?? ''}</span>
              </div>
            </div>
          );
        })}
      </div>

      {final && final.result && (
        <section className="card stack">
          <h2 className="display">Final round: {final.prompt.text}</h2>
          <div className="stack">
            {[...final.answers]
              .sort(
                (a, b) =>
                  (final.result![b.playerId!]?.points ?? 0) -
                  (final.result![a.playerId!]?.points ?? 0),
              )
              .map((answer) => {
                const tally = final.result![answer.playerId!];
                const player = byId.get(answer.playerId!);
                return (
                  <div key={answer.playerId} className="fanswer row">
                    <Character characterId={player?.characterId ?? null} size={40} />
                    <div className="grow">
                      <AnswerText
                        text={answer.text ?? '…'}
                        filter={room.settings.profanityFilter && answer.playerId !== me}
                        className="fanswer__text"
                      />
                      <span className="dim small">
                        {player?.name} · {tally?.first ?? 0}× 1st, {tally?.second ?? 0}× 2nd
                      </span>
                    </div>
                    <span className="display fanswer__pts">+{tally?.points ?? 0}</span>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {podium && podium.superlatives.length > 0 && (
        <section className="card ticker">
          <div className="ticker__track">
            {[...podium.superlatives, ...podium.superlatives].map((s, i) => (
              <span key={i} className="ticker__item">
                <b className="display">{s.title}:</b> {byId.get(s.playerId)?.name ?? '?'}{' '}
                <span className="dim">· {s.detail}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <ol className="board">
        {placements.map((p) => {
          const player = byId.get(p.playerId);
          return (
            <li
              key={p.playerId}
              className={`board__row ${p.playerId === me ? 'board__row--me' : ''}`}
            >
              <span className="board__rank display">{p.place}</span>
              <Character characterId={player?.characterId ?? null} size={44} />
              <span
                className="board__name"
                style={{ background: characterMeta(player?.characterId)?.accent }}
              >
                {player?.name}
              </span>
              <span className="board__score display">{p.score}</span>
            </li>
          );
        })}
      </ol>

      <div className="row">
        {isLeader ? (
          <button
            className="btn grow"
            type="button"
            onClick={() => {
              sfx.tap();
              ctl.rematch();
            }}
          >
            Rematch
          </button>
        ) : (
          <p className="dim grow center">Waiting for the leader to start a rematch…</p>
        )}
        <button className="btn btn--ghost" type="button" onClick={() => ctl.leaveRoom()}>
          Leave
        </button>
      </div>
    </main>
  );
}
