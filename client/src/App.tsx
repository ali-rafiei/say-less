import type { RoomPhase } from '@say-less/shared';
import { useEffect } from 'react';
import { sfx } from './audio/sfx.ts';
import { Backdrop, type Palette } from './components/Backdrop.tsx';
import { useRoom } from './net/useRoom.ts';
import { FinalVoting } from './screens/FinalVoting.tsx';
import { Home } from './screens/Home.tsx';
import { Lobby } from './screens/Lobby.tsx';
import { MatchupReveal } from './screens/MatchupReveal.tsx';
import { Podium } from './screens/Podium.tsx';
import { RoundIntro } from './screens/RoundIntro.tsx';
import { RoundResults } from './screens/RoundResults.tsx';
import { Voting } from './screens/Voting.tsx';
import { Writing } from './screens/Writing.tsx';

const PALETTES: Record<RoomPhase, Palette> = {
  LOBBY: 'lobby',
  ROUND_INTRO: 'writing',
  WRITING: 'writing',
  FINAL_WRITING: 'writing',
  VOTING: 'voting',
  FINAL_VOTING: 'voting',
  MATCHUP_REVEAL: 'results',
  ROUND_RESULTS: 'results',
  PODIUM: 'podium',
};

export function App() {
  const ctl = useRoom();
  const { room, me, error, dismissError, status, everConnected, displaced, playHere } = ctl;

  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(dismissError, 3_500);
    return () => clearTimeout(t);
  }, [error, dismissError]);

  const phase = room?.phase;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase, room?.currentMatchupIndex]);

  const palette: Palette = room ? PALETTES[room.phase] : 'home';
  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#1a1a2e');
  }, [palette]);

  let screen;
  if (!room || !me) {
    screen = <Home ctl={ctl} />;
  } else {
    switch (room.phase) {
      case 'LOBBY':
        screen = <Lobby ctl={ctl} room={room} me={me} />;
        break;
      case 'ROUND_INTRO':
        screen = <RoundIntro ctl={ctl} room={room} />;
        break;
      case 'WRITING':
      case 'FINAL_WRITING':
        screen = <Writing ctl={ctl} room={room} me={me} />;
        break;
      case 'VOTING':
        screen = <Voting ctl={ctl} room={room} me={me} />;
        break;
      case 'MATCHUP_REVEAL':
        screen = <MatchupReveal ctl={ctl} room={room} me={me} />;
        break;
      case 'ROUND_RESULTS':
        screen = <RoundResults ctl={ctl} room={room} me={me} />;
        break;
      case 'FINAL_VOTING':
        screen = <FinalVoting ctl={ctl} room={room} me={me} />;
        break;
      case 'PODIUM':
        screen = <Podium ctl={ctl} room={room} me={me} />;
        break;
    }
  }

  return (
    <div className="app" data-palette={palette}>
      <Backdrop palette={palette} />
      {status !== 'open' && !displaced && (
        <div className="conn" role="status">
          {status === 'connecting' ? (everConnected ? 'Reconnecting…' : 'Connecting…') : 'Offline'}
        </div>
      )}
      {screen}
      {displaced && (
        <div className="overlay" role="dialog" aria-label="Open in another tab">
          <div className="card stack center">
            <h2 className="display">Open in another tab</h2>
            <p>This game is being played in another tab of this browser.</p>
            <button className="btn btn--block" type="button" onClick={playHere}>
              Play here
            </button>
          </div>
        </div>
      )}
      {error && (
        <button className="toast" type="button" role="alert" onClick={dismissError}>
          {error.message}
        </button>
      )}
    </div>
  );
}
