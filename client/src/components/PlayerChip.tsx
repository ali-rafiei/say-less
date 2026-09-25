import { UIArt } from './UIArt.tsx';
import { characterMeta, type PublicPlayer } from '@say-less/shared';
import { Character, type CharacterState } from './Character.tsx';

interface Props {
  player: PublicPlayer;
  isLeader?: boolean;
  state?: CharacterState;
  size?: number;
  badge?: string | null;
  muted?: boolean;
}

export function PlayerChip({ player, isLeader, state = 'idle', size = 64, badge, muted }: Props) {
  const meta = characterMeta(player.characterId);
  return (
    <div
      className={`pchip ${muted ? 'pchip--muted' : ''} ${player.connected ? '' : 'pchip--offline'}`}
    >
      <div className="pchip__avatar" style={{ background: meta?.accent ?? 'var(--bg-2)' }}>
        {player.characterId ? (
          <Character characterId={player.characterId} state={state} size={size} />
        ) : (
          <span className="pchip__initial display">{player.name.slice(0, 1).toUpperCase()}</span>
        )}
        {isLeader && (
          <span className="pchip__crown" role="img" aria-label="Leader">
            <UIArt name="crown" />
          </span>
        )}
        {badge && <span className="pchip__badge">{badge}</span>}
      </div>
      <span className="pchip__name">{player.name}</span>
      {!player.connected && <span className="pchip__offline">offline</span>}
    </div>
  );
}
