import { CHARACTER_IDS } from '@say-less/shared';

export type CharacterState = 'idle' | 'writing' | 'waiting' | 'win' | 'lose';

interface Props {
  characterId: string | null;
  state?: CharacterState;
  size?: number | string;
  className?: string;
}

/** Every character has a painted sprite per state in /public/sprites/<id>/<state>.webp. */
export function Character({ characterId, state = 'idle', size = 96, className = '' }: Props) {
  const dimension = typeof size === 'number' ? `${size}px` : size;
  const style = { width: dimension, height: dimension };
  if (!characterId || !CHARACTER_IDS.includes(characterId)) {
    return <div className={`char-wrap char-empty ${className}`} style={style} data-state={state} />;
  }
  return (
    <div
      className={`char-wrap char-sprite char-${characterId} ${className}`}
      style={style}
      data-state={state}
    >
      <img
        src={`${import.meta.env.BASE_URL}sprites/${characterId}/${state}.webp`}
        alt=""
        draggable={false}
      />
    </div>
  );
}
