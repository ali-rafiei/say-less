import { ROUNDS, type PublicRoomState } from '@say-less/shared';
import { LimitChips } from '../components/LimitChips.tsx';
import type { RoomController } from '../net/useRoom.ts';

export function RoundIntro({ room }: { ctl: RoomController; room: PublicRoomState }) {
  const round = ROUNDS[room.roundIndex]!;
  const previous = room.roundIndex > 0 ? ROUNDS[room.roundIndex - 1]!.limit : undefined;
  const limited = room.settings.wordLimits;
  return (
    <main className="screen center intro">
      <span className="dim display">Round {room.roundIndex + 1}</span>
      <h1 className="intro__name display">{round.name}</h1>
      {limited && (
        <div className="intro__chips">
          <LimitChips limit={round.limit} shatterFrom={previous} size="large" />
        </div>
      )}
      <p className="intro__limit display">
        {limited ? `${round.limit} ${round.limit === 1 ? 'word' : 'words'}` : 'No word limit'}
      </p>
      {room.roundIndex < ROUNDS.length - 1 && room.settings.mode === 'doodle' && (
        <p className="display">First, draw. Then caption someone else's art.</p>
      )}
      {room.roundIndex < ROUNDS.length - 1 && room.settings.mode === 'context' && (
        <p className="display">First, a question about you. Then swap someone's question.</p>
      )}
      <p className="dim">
        ×{round.multiplier} points
        {room.roundIndex === 1 && room.settings.roasts ? ' · roast tokens unlocked' : ''}
      </p>
    </main>
  );
}
