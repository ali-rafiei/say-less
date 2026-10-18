import type { PublicRoomState } from '@say-less/shared';
import { Header } from '../components/Header.tsx';
import { PlayerChip } from '../components/PlayerChip.tsx';
import { UIArt } from '../components/UIArt.tsx';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
}

/** The audience watches the players write; their turn comes at the vote. */
export function AudienceWait({ ctl, room }: Props) {
  const done = room.players.filter((p) => room.submittedIds.includes(p.id)).length;
  const drawing = room.phase === 'CREATING' && room.settings.mode === 'doodle';
  return (
    <main className="screen audience">
      <Header ctl={ctl} room={room} />
      <section className="card stack center waitroom">
        <span className="audience__tag display">You're in the audience</span>
        <h2 className="display">
          <UIArt name="pencil" /> {done} of {room.players.length} done
        </h2>
        <div className="pgrid">
          {room.players.map((p) => {
            const finished = room.submittedIds.includes(p.id);
            return (
              <PlayerChip
                key={p.id}
                player={p}
                state={finished ? 'waiting' : 'writing'}
                size={56}
                badge={finished ? 'done' : null}
              />
            );
          })}
        </div>
        <p className="dim small">
          The players are {drawing ? 'drawing' : 'writing'}. When the answers are in, you vote too:
          the answer the audience prefers gets the Crowd Favourite bonus.
        </p>
      </section>
    </main>
  );
}
