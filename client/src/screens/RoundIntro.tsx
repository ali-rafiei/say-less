import { FINAL_ROUND, INITIALS_LENGTHS, ROUNDS, type PublicRoomState } from '@say-less/shared';
import { LimitChips } from '../components/LimitChips.tsx';
import type { RoomController } from '../net/useRoom.ts';

export function RoundIntro({ room }: { ctl: RoomController; room: PublicRoomState }) {
  const round = ROUNDS[room.roundIndex]!;
  const initials = room.settings.mode === 'initials';
  const isFinal = room.roundIndex === FINAL_ROUND;
  // A short game jumps from round 1 to the final, so the tiles shatter from round 1's count.
  const previousIndex =
    room.roundIndex === 0
      ? null
      : isFinal && room.settings.length === 'short'
        ? 0
        : room.roundIndex - 1;
  const budget = (index: number) => (initials ? INITIALS_LENGTHS[index]! : ROUNDS[index]!.limit);
  const limit = budget(room.roundIndex);
  const previous = previousIndex === null ? undefined : budget(previousIndex);
  const limited = initials || room.settings.wordLimits;
  const unit = initials ? 'letter' : 'word';
  return (
    <main className="screen center intro">
      <span className="dim display">
        {isFinal ? 'Final round' : `Round ${room.roundIndex + 1}`}
      </span>
      <h1 className="intro__name display">{round.name}</h1>
      {limited && (
        <div className="intro__chips">
          <LimitChips limit={limit} shatterFrom={previous} size="large" />
        </div>
      )}
      <p className="intro__limit display">
        {limited ? `${limit} ${unit}${limit === 1 ? '' : 's'}` : 'No word limit'}
      </p>
      {initials && <p className="display">Every word starts with the next letter. In order.</p>}
      {room.roundIndex < ROUNDS.length - 1 && room.settings.mode === 'doodle' && (
        <p className="display">First, draw. Then caption someone else's art.</p>
      )}
      {room.roundIndex < ROUNDS.length - 1 && room.settings.mode === 'context' && (
        <p className="display">
          First, a question about you. Then take someone's answer out of context.
        </p>
      )}
      <p className="dim">
        ×{round.multiplier} points
        {room.roundIndex === 1 && room.settings.roasts ? ' · roast tokens unlocked' : ''}
      </p>
    </main>
  );
}
