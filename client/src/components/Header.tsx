import { ROUNDS, type PublicRoomState } from '@say-less/shared';
import { LimitChips } from './LimitChips.tsx';
import { SoundControls } from './SoundControls.tsx';
import { TimerRing } from './TimerRing.tsx';

interface Props {
  room: PublicRoomState;
  clockOffset: number;
  limit?: number | null;
  limitLabel?: string;
  /** false on screens with no decision to make against the clock */
  showTimer?: boolean;
}

export function Header({ room, clockOffset, limit, limitLabel, showTimer = true }: Props) {
  const inRound = room.phase !== 'LOBBY' && room.phase !== 'PODIUM';
  const round = ROUNDS[room.roundIndex];
  return (
    <header className="header">
      <div className="header__left">
        <span className="header__code display">{room.code}</span>
        {inRound && round && (
          <span className="header__round">
            {room.roundIndex === ROUNDS.length - 1 ? 'Final round' : `Round ${room.roundIndex + 1}`}
          </span>
        )}
      </div>
      <div className="header__mid">
        {limit != null && <LimitChips limit={limit} label={limitLabel ?? `${limit}`} />}
      </div>
      <div className="header__right">
        {showTimer && (
          <TimerRing
            endsAt={room.phaseEndsAt}
            startedAt={room.phaseStartedAt}
            clockOffset={clockOffset}
            size={48}
          />
        )}
        <SoundControls />
      </div>
    </header>
  );
}
