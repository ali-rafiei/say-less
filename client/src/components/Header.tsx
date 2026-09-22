import { ROUNDS, type PublicRoomState } from '@say-less/shared';
import { useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { LimitChips } from './LimitChips.tsx';
import { TimerRing } from './TimerRing.tsx';

interface Props {
  room: PublicRoomState;
  clockOffset: number;
  limit?: number | null;
  limitLabel?: string;
}

export function Header({ room, clockOffset, limit, limitLabel }: Props) {
  const [muted, setMuted] = useState(sfx.muted);
  const inRound = room.phase !== 'LOBBY' && room.phase !== 'CHAR_SELECT' && room.phase !== 'PODIUM';
  const round = ROUNDS[room.roundIndex];
  return (
    <header className="header">
      <div className="header__left">
        <span className="header__code display">{room.code}</span>
        {inRound && round && (
          <span className="header__round">
            R{room.roundIndex + 1} · {round.name}
          </span>
        )}
      </div>
      <div className="header__mid">
        {limit != null && <LimitChips limit={limit} label={limitLabel ?? `${limit}`} />}
      </div>
      <div className="header__right">
        <TimerRing
          endsAt={room.phaseEndsAt}
          startedAt={room.phaseStartedAt}
          clockOffset={clockOffset}
          size={48}
        />
        <button
          className="mute"
          type="button"
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          onClick={() => {
            sfx.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );
}
