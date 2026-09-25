import type { CSSProperties } from 'react';
import bounds from '../../public/ui/manifest.json';

export type UIArtName = keyof typeof bounds;

/** Display the painted bounds without the square export's transparent padding. */
export function UIArt({
  name,
  label = '',
  className = '',
}: {
  name: UIArtName;
  label?: string;
  className?: string;
}) {
  const { x, y, width, height, size } = bounds[name];
  const style = {
    aspectRatio: `${width} / ${height}`,
    '--art-width': `${(size / width) * 100}%`,
    '--art-height': `${(size / height) * 100}%`,
    '--art-left': `${(-x / width) * 100}%`,
    '--art-top': `${(-y / height) * 100}%`,
  } as CSSProperties;
  return (
    <span className={`ui-art ${className}`} style={style} aria-hidden={label ? undefined : true}>
      <img src={`${import.meta.env.BASE_URL}ui/${name}.png`} alt={label} draggable={false} />
    </span>
  );
}
