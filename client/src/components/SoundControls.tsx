import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { sfx } from '../audio/sfx.ts';
import { UIArt } from './UIArt.tsx';
import './SoundControls.css';

const effectsMuted = () => sfx.muted;
const musicOn = () => sfx.musicOn;

/** One header button that opens separate music and sound-effect switches. */
export function SoundControls() {
  const effects = !useSyncExternalStore(sfx.subscribe, effectsMuted, effectsMuted);
  const music = useSyncExternalStore(sfx.subscribe, musicOn, musicOn);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="sound" ref={rootRef}>
      <button
        ref={triggerRef}
        className="mute"
        type="button"
        aria-label="Sound settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <UIArt name={effects || music ? 'sound-on' : 'sound-off'} />
      </button>
      {open && (
        <div className="sound__panel card" id={panelId} role="group" aria-label="Sound">
          <div className="row row--between">
            <span className="sound__label">
              <MusicNote off={!music} />
              Music
            </span>
            <button
              className={`toggle ${music ? 'toggle--on' : ''}`}
              type="button"
              aria-label="Music"
              aria-pressed={music}
              onClick={() => {
                sfx.setMusicOn(!music);
                sfx.tap();
              }}
            >
              {music ? 'On' : 'Off'}
            </button>
          </div>
          <div className="row row--between">
            <span className="sound__label">
              <UIArt name={effects ? 'sound-on' : 'sound-off'} />
              Effects
            </span>
            <button
              className={`toggle ${effects ? 'toggle--on' : ''}`}
              type="button"
              aria-label="Sound effects"
              aria-pressed={effects}
              onClick={() => {
                sfx.setMuted(effects);
                sfx.tap();
              }}
            >
              {effects ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MusicNote({ off }: { off: boolean }) {
  return (
    <svg className="sound__icon" viewBox="0 0 28 28" aria-hidden="true">
      <path
        d="M10 20.5V7.5l13-3v13"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M10 7.5l13-3v4l-13 3z" fill="var(--ink)" />
      <ellipse
        cx="6.5"
        cy="20.5"
        rx="4.5"
        ry="3.5"
        fill="var(--accent)"
        stroke="var(--ink)"
        strokeWidth="2.5"
      />
      <ellipse
        cx="19.5"
        cy="17.5"
        rx="4.5"
        ry="3.5"
        fill="var(--accent)"
        stroke="var(--ink)"
        strokeWidth="2.5"
      />
      {off && (
        <path d="M3 3l22 22" stroke="var(--danger)" strokeWidth="3.5" strokeLinecap="round" />
      )}
    </svg>
  );
}
