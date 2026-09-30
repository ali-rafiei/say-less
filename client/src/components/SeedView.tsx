import type { PublicRoomState, PublicSeed } from '@say-less/shared';
import { AnswerText } from './AnswerText.tsx';
import { DrawingView } from './DrawingView.tsx';

interface Props {
  seed: PublicSeed;
  room: PublicRoomState;
  drawings: Record<string, string>;
  me: string;
}

/** What a Doodle or Burn Book prompt is built on: someone's drawing or honest answer. */
export function SeedView({ seed, room, drawings, me }: Props) {
  if (seed.kind === 'drawing') {
    const artist = room.players.find((p) => p.id === seed.artistId);
    return (
      <figure className="seed seed--drawing">
        <div className="seed__art">
          <DrawingView
            drawing={drawings[seed.drawingId] ?? ''}
            label={artist ? `${artist.name}'s drawing` : "A player's drawing"}
          />
        </div>
        {artist && <figcaption className="seed__by dim small">drawn by {artist.name}</figcaption>}
      </figure>
    );
  }
  const subject = room.players.find((p) => p.id === seed.subjectId);
  return (
    <div className="seed seed--confession">
      <span className="seed__who display">{subject?.name ?? 'Someone'} was asked</span>
      <span className="seed__question">{seed.question}</span>
      <AnswerText
        text={seed.answer}
        compact
        filter={room.settings.profanityFilter && seed.subjectId !== me}
        className="seed__answer"
      />
    </div>
  );
}
