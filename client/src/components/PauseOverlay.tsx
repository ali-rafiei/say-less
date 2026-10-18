import type { PublicRoomState } from '@say-less/shared';
import { sfx } from '../audio/sfx.ts';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
}

export function PauseOverlay({ ctl, room }: Props) {
  const paused = room.paused;
  if (!paused) return null;
  const isLeader = room.leaderId === ctl.me;
  const seconds = paused.remainingMs === null ? null : Math.ceil(paused.remainingMs / 1000);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Game paused">
      <div className="overlay__box">
        <h2 className="display">Paused</h2>
        <p>
          <b>{paused.byName}</b> hit pause.
          {seconds !== null && ` ${seconds}s left on the clock when you're back.`}
        </p>
        <p className="dim small">Drafts are kept. Nothing can be sent until the game resumes.</p>
        {isLeader ? (
          <button
            className="btn"
            type="button"
            autoFocus
            onClick={() => {
              sfx.tap();
              ctl.resumeGame();
            }}
          >
            Resume
          </button>
        ) : (
          <p className="dim">Waiting for the leader to resume…</p>
        )}
      </div>
    </div>
  );
}
