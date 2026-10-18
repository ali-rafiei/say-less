import type { PublicRoomState } from '@say-less/shared';
import { sfx } from '../audio/sfx.ts';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
}

/** The leader's in-game row: pause, and Move on when the room plays without timers. */
export function HostControls({ ctl, room }: Props) {
  if (room.leaderId !== ctl.me || room.paused) return null;
  const movable =
    room.settings.timers === 'off' &&
    (room.phase === 'CREATING' ||
      (room.phase === 'WRITING' && room.roastWindowEndsAt === null) ||
      room.phase === 'FINAL_WRITING' ||
      room.phase === 'VOTING' ||
      room.phase === 'FINAL_VOTING');
  return (
    <div className="host" role="group" aria-label="Leader controls">
      <span className="host__label dim small">Leader</span>
      {movable && (
        <button
          className="host__btn host__btn--next"
          type="button"
          onClick={() => {
            sfx.tap();
            ctl.advancePhase();
          }}
        >
          Move on ▸
        </button>
      )}
      <button
        className="host__btn"
        type="button"
        aria-label="Pause the game"
        onClick={() => {
          sfx.tap();
          ctl.pauseGame();
        }}
      >
        ❚❚ Pause
      </button>
    </div>
  );
}
