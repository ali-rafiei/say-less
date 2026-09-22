import { CHARACTERS, type PublicRoomState } from '@say-less/shared';
import { sfx } from '../audio/sfx.ts';
import { Character } from '../components/Character.tsx';
import { Header } from '../components/Header.tsx';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

export function CharSelect({ ctl, room, me }: Props) {
  const mine = room.players.find((p) => p.id === me)?.characterId ?? null;
  return (
    <main className="screen screen--wide">
      <Header room={room} clockOffset={ctl.clockOffset} />
      <h2 className="display center">Pick your character</h2>
      <p className="center dim">First tap wins. Unpicked players get a random leftover.</p>
      <div className="cgrid">
        {CHARACTERS.map((c) => {
          const owner = room.players.find((p) => p.characterId === c.id);
          const taken = owner && owner.id !== me;
          const isMine = mine === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className={`ccell ${taken ? 'ccell--taken' : ''} ${isMine ? 'ccell--mine' : ''}`}
              style={{ ['--accent-c' as string]: c.accent }}
              disabled={Boolean(taken)}
              onClick={() => {
                sfx.tap();
                ctl.pickCharacter(c.id);
              }}
            >
              <Character characterId={c.id} state={isMine ? 'win' : 'idle'} size="100%" />
              <span className="ccell__name display">{c.name}</span>
              {owner && (
                <span className="ccell__owner">{owner.id === me ? 'You' : owner.name}</span>
              )}
            </button>
          );
        })}
      </div>
    </main>
  );
}
