import { SITES, type PublicRoomState, type PublicSeed } from '@say-less/shared';
import { AnswerText } from './AnswerText.tsx';
import { Character } from './Character.tsx';
import { DrawingView } from './DrawingView.tsx';

interface Props {
  seed: PublicSeed;
  room: PublicRoomState;
  drawings: Record<string, string>;
  me: string;
}

/** What a Doodle or Out of Context prompt is built on: someone's drawing or honest answer. */
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
  return <PostView seed={seed} room={room} me={me} twist={null} />;
}

interface PostProps {
  seed: Extract<PublicSeed, { kind: 'post' }>;
  room: PublicRoomState;
  me: string;
  /** the twister's context; null while it is still being written */
  twist: string | null;
}

/** Out of Context: the victim's quote dressed up as a post on a fake site, under the twist. */
export function PostView({ seed, room, me, twist }: PostProps) {
  const site = SITES[seed.site];
  const victim = room.players.find((p) => p.id === seed.victimId);
  return (
    <article className={`post post--${site.id}`}>
      <span className="post__site display">{site.name}</span>
      <h3 className={`post__twist display ${twist === null ? 'post__twist--blank' : ''}`}>
        {twist === null ? (
          '???'
        ) : (
          <AnswerText text={twist} compact filter={room.settings.profanityFilter} />
        )}
      </h3>
      <div className="post__quote">
        <span className="post__label dim small">{site.quoteLabel}</span>
        <span className="post__who">
          <Character characterId={victim?.characterId ?? null} size={28} />
          <b>{victim?.name ?? 'Someone'}</b>
        </span>
        <AnswerText
          text={seed.quote}
          compact
          filter={room.settings.profanityFilter && seed.victimId !== me}
          className="post__text"
        />
      </div>
    </article>
  );
}
