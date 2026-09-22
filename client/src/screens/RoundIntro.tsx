import { ROUNDS, type PublicRoomState } from '@say-less/shared';
import { LimitChips } from '../components/LimitChips.tsx';
import type { RoomController } from '../net/useRoom.ts';

export function RoundIntro({ room }: { ctl: RoomController; room: PublicRoomState }) {
  const round = ROUNDS[room.roundIndex]!;
  const previous = room.roundIndex > 0 ? ROUNDS[room.roundIndex - 1]!.limit : undefined;
  const emoji = room.final?.mode === 'emoji';
  const limit = emoji ? room.final!.limit : round.limit;
  return (
    <main className="screen center intro">
      <span className="dim display">Round {room.roundIndex + 1}</span>
      <h1 className="intro__name display">{round.name}</h1>
      <div className="intro__chips">
        <LimitChips limit={limit} shatterFrom={emoji ? undefined : previous} size="large" />
      </div>
      <p className="intro__limit display">
        {limit} {emoji ? 'emoji' : limit === 1 ? 'word' : 'words'}
      </p>
      <p className="dim">
        ×{round.multiplier} points{room.roundIndex === 1 ? ' · roast tokens unlocked' : ''}
      </p>
    </main>
  );
}
