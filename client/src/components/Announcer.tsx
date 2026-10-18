import type { PublicRoomState } from '@say-less/shared';
import { useEffect, useRef, useState } from 'react';

/** One sentence per game event for screen readers (the phone has no narrator). It only says
 *  what the screen does not already show as text (results, leaders, pause), so headings are
 *  never read twice. */
export function Announcer({ room }: { room: PublicRoomState | null }) {
  const [message, setMessage] = useState('');
  const lastKey = useRef('');
  useEffect(() => {
    if (!room) return;
    const key = `${room.phase}:${room.roundIndex}:${room.currentMatchupIndex}:${room.paused ? 'p' : ''}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const text = describe(room);
    if (text) setMessage(text);
  }, [room]);
  return (
    <div className="sr-only" aria-live="polite" role="status">
      {message}
    </div>
  );
}

function nameOf(room: PublicRoomState, id: string | null | undefined): string {
  return room.players.find((p) => p.id === id)?.name ?? 'Someone';
}

function describe(room: PublicRoomState): string | null {
  if (room.paused) return `Game paused by ${room.paused.byName}.`;
  switch (room.phase) {
    case 'WRITING':
    case 'FINAL_WRITING':
      return 'Time to write.';
    case 'MATCHUP_REVEAL': {
      const m = room.matchups[room.currentMatchupIndex];
      const result = m?.result;
      if (!m || !result) return null;
      if (result.greatMinds) return 'Great minds: both wrote the same thing.';
      if (result.winnerIndex === null) return 'A tie.';
      const winner = m.answers[result.winnerIndex];
      return `${nameOf(room, winner?.playerId)} wins with ${result.voteCounts[result.winnerIndex]} votes.`;
    }
    case 'ROUND_RESULTS': {
      const top = [...room.players].sort((a, b) => b.score - a.score)[0];
      return top ? `${top.name} leads with ${top.score} points.` : null;
    }
    case 'PODIUM': {
      const first = room.podium?.placements.filter((p) => p.place === 1) ?? [];
      return first.length > 0
        ? `${first.map((p) => nameOf(room, p.playerId)).join(' and ')} won with ${first[0]!.score} points.`
        : null;
    }
    default:
      return null;
  }
}
