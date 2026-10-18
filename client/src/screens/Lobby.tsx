import { UIArt } from '../components/UIArt.tsx';
import { SoundControls } from '../components/SoundControls.tsx';
import {
  CHARACTERS,
  LIMITS,
  PACKS,
  type GameLength,
  type GameMode,
  type PublicRoomState,
  type RoomSettings,
  type TimerSpeed,
} from '@say-less/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sfx } from '../audio/sfx.ts';
import { Character } from '../components/Character.tsx';
import { ConfirmButton } from '../components/ConfirmButton.tsx';
import { PlayerChip } from '../components/PlayerChip.tsx';
import type { RoomController } from '../net/useRoom.ts';

const MODES: { id: GameMode; name: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic', blurb: 'Answer prompts from the packs' },
  { id: 'custom', name: 'Custom', blurb: 'Everyone writes the prompts' },
  { id: 'doodle', name: 'Doodle', blurb: 'Draw, then caption the art' },
  { id: 'context', name: 'Out of Context', blurb: 'Answer honestly, swap the question' },
  { id: 'initials', name: 'Initials', blurb: 'Every word starts with the given letters' },
];

const TIMER_SPEEDS: { id: TimerSpeed; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'relaxed', name: 'Relaxed' },
  { id: 'off', name: 'Off' },
];

const LENGTHS: { id: GameLength; name: string }[] = [
  { id: 'full', name: 'Full' },
  { id: 'short', name: 'Short' },
];

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

export function Lobby({ ctl, room, me }: Props) {
  const isLeader = room.leaderId === me;
  const watching = room.viewer.role === 'audience';
  const initials = room.settings.mode === 'initials';
  const leader = room.players.find((p) => p.id === room.leaderId);
  const mine = room.players.find((p) => p.id === me)?.characterId ?? null;
  const [copied, setCopied] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const custom = room.settings.mode === 'custom';
  const usesPacks = room.settings.mode === 'classic' || custom || initials;
  const set = (patch: Partial<RoomSettings>) => {
    sfx.tap();
    ctl.updateSettings(patch);
  };
  // Taps faster than the server echo must each count: the stepper keeps its own value and
  // ignores echoes of earlier taps until the last value it sent comes back (or is refused).
  const [seats, setSeats] = useState(room.settings.maxPlayers);
  const sentSeats = useRef<number | null>(null);
  const serverSeats = room.settings.maxPlayers;
  useEffect(() => {
    if (sentSeats.current !== null && sentSeats.current !== serverSeats) return;
    sentSeats.current = null;
    setSeats(serverSeats);
  }, [serverSeats]);
  useEffect(() => {
    sentSeats.current = null;
    setSeats(serverSeats);
    // Keyed on refusals only: the server value is read fresh when one arrives.
  }, [ctl.error?.at]);
  const changeSeats = (next: number) => {
    sentSeats.current = next;
    setSeats(next);
    set({ maxPlayers: next });
  };
  const promptsNeeded = room.players.length * 2 + 1;

  function addPrompt(event: FormEvent) {
    event.preventDefault();
    const text = promptDraft.trim();
    if (text.length < 3) return;
    sfx.tap();
    ctl.addPrompt(text);
    setPromptDraft('');
  }
  const inviteUrl = `${location.origin}${location.pathname}?code=${room.code}`;

  async function copyLink() {
    sfx.tap();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Say Less',
          text: `Join my Say Less room: ${room.code}`,
          url: inviteUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // user cancelled the share sheet
    }
  }

  return (
    <main className="screen screen--wide lobby">
      <div className="screen-sound">
        <SoundControls />
      </div>
      <div className="stack center">
        <span className="dim">Room code</span>
        <div className="roomcode display">{room.code}</div>
        <button className="btn btn--small btn--secondary" type="button" onClick={copyLink}>
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </div>

      {room.banner && <div className="banner">{room.banner}</div>}

      {watching && (
        <section className="card stack center">
          <span className="audience__tag display">You're in the audience</span>
          <p className="small">
            The room is full, so you watch and vote. You get a seat as soon as one opens.
          </p>
        </section>
      )}

      <section className="card stack">
        <div className="row row--between">
          <h2 className="display">Players</h2>
          <span className="dim">
            {room.players.length} / {room.settings.maxPlayers}
            {room.audienceCount > 0 && ` · ${room.audienceCount} watching`}
          </span>
        </div>
        <div className="pgrid">
          {room.players.map((p) => (
            <div key={p.id} className="pslot">
              <PlayerChip player={p} isLeader={p.id === room.leaderId} size={56} />
              {isLeader && p.id !== me && (
                <ConfirmButton
                  label="✕"
                  confirmLabel="Remove?"
                  ariaLabel={`Remove ${p.name}`}
                  className="pslot__kick"
                  onConfirm={() => ctl.kickPlayer(p.id)}
                />
              )}
            </div>
          ))}
          {Array.from({ length: Math.max(LIMITS.MIN_PLAYERS - room.players.length, 0) }, (_, i) => (
            <div key={`empty-${i}`} className="pchip pchip--empty">
              <div className="pchip__avatar pchip__avatar--empty">
                <UIArt name="seat" className="seat-art" />
              </div>
              <span className="pchip__name dim">waiting…</span>
            </div>
          ))}
        </div>
      </section>

      {!watching && (
        <section className="stack">
          <h2 className="display center">{mine ? 'Your character' : 'Pick your character'}</h2>
          <p className="center dim small">
            Tap a character to claim it. First tap wins; anyone who skips gets a random leftover.
          </p>
          <div className="cgrid">
            {CHARACTERS.map((c) => {
              const owner = room.players.find((p) => p.characterId === c.id);
              const taken = owner && owner.id !== me;
              const isMine = mine === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`ccell ${taken ? 'ccell--taken' : ''} ${isMine ? 'ccell--mine' : ''}`}
                  style={{ ['--accent-c' as string]: c.accent }}
                  disabled={Boolean(taken)}
                  onClick={() => {
                    sfx.tap();
                    ctl.pickCharacter(c.id);
                  }}
                >
                  <Character characterId={c.id} state={isMine ? 'win' : 'idle'} size="100%" />
                  <span className="ccell__name display">{c.name}</span>
                  {owner && <span className="ccell__owner">{owner.name}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="card stack">
        <h2 className="display">Settings</h2>
        <span>Game mode</span>
        <div className="modes" role="radiogroup" aria-label="Game mode">
          {MODES.map((mode) => {
            const on = room.settings.mode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={mode.name}
                className={`mode ${on ? 'mode--on' : ''}`}
                disabled={!isLeader}
                onClick={() => {
                  sfx.tap();
                  ctl.updateSettings({ mode: mode.id });
                }}
              >
                <span className="mode__name display">{mode.name}</span>
                <span className="mode__blurb">{mode.blurb}</span>
              </button>
            );
          })}
        </div>
        {usesPacks && (
          <>
            <span>
              Prompt packs
              <span className="dim small setting__hint">mix as many as you like</span>
            </span>
            <div className="packs" role="group" aria-label="Prompt packs">
              {PACKS.map((pack) => {
                const on = room.settings.packs.includes(pack.id);
                return (
                  <button
                    key={pack.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={pack.name}
                    title={pack.blurb}
                    className={`pack ${on ? 'pack--on' : ''}`}
                    disabled={!isLeader || (on && room.settings.packs.length === 1)}
                    onClick={() => {
                      sfx.tap();
                      ctl.updateSettings({
                        packs: on
                          ? room.settings.packs.filter((id) => id !== pack.id)
                          : [...room.settings.packs, pack.id],
                      });
                    }}
                  >
                    {pack.name}
                    {pack.mature && <span className="pack__tag">18+</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="row row--between">
          <span>Profanity filter</span>
          <button
            className={`toggle ${room.settings.profanityFilter ? 'toggle--on' : ''}`}
            type="button"
            disabled={!isLeader}
            aria-pressed={room.settings.profanityFilter}
            onClick={() => {
              sfx.tap();
              ctl.updateSettings({ profanityFilter: !room.settings.profanityFilter });
            }}
          >
            {room.settings.profanityFilter ? 'On' : 'Off'}
          </button>
        </div>
        {/* Roasts cut a matchup rival; Out of Context has no matchups. */}
        {room.settings.mode !== 'context' && (
          <div className="row row--between">
            <span>
              Roasts
              <span className="dim small setting__hint">cut a rival to 2 words in round 2</span>
            </span>
            <button
              className={`toggle ${room.settings.roasts ? 'toggle--on' : ''}`}
              type="button"
              disabled={!isLeader}
              aria-pressed={room.settings.roasts}
              aria-label="Roasts"
              onClick={() => {
                sfx.tap();
                ctl.updateSettings({ roasts: !room.settings.roasts });
              }}
            >
              {room.settings.roasts ? 'On' : 'Off'}
            </button>
          </div>
        )}
        {!initials && (
          <div className="row row--between">
            <span>
              Word limits
              <span className="dim small setting__hint">off: say as much as you like</span>
            </span>
            <button
              className={`toggle ${room.settings.wordLimits ? 'toggle--on' : ''}`}
              type="button"
              disabled={!isLeader}
              aria-pressed={room.settings.wordLimits}
              aria-label="Word limits"
              onClick={() => {
                sfx.tap();
                ctl.updateSettings({ wordLimits: !room.settings.wordLimits });
              }}
            >
              {room.settings.wordLimits ? 'On' : 'Off'}
            </button>
          </div>
        )}
        <span>
          Timers
          <span className="dim small setting__hint">
            {room.settings.timers === 'off'
              ? 'no clock: the leader taps Move on'
              : room.settings.timers === 'relaxed'
                ? 'double time to write and vote'
                : 'the standard clock'}
          </span>
        </span>
        <Segmented
          label="Timers"
          options={TIMER_SPEEDS}
          value={room.settings.timers}
          disabled={!isLeader}
          onChange={(timers) => set({ timers })}
        />
        <span>
          Game length
          <span className="dim small setting__hint">
            {room.settings.length === 'short'
              ? 'round 1, then straight to the final'
              : 'three rounds, the limit shrinking each time'}
          </span>
        </span>
        <Segmented
          label="Game length"
          options={LENGTHS}
          value={room.settings.length}
          disabled={!isLeader}
          onChange={(length) => set({ length })}
        />
        {!initials && (
          <Toggle
            label="Bail Outs"
            hint="stuck? submit a stock answer for half points"
            on={room.settings.bailOuts}
            disabled={!isLeader}
            onChange={(bailOuts) => set({ bailOuts })}
          />
        )}
        {room.settings.mode !== 'context' && (
          <Toggle
            label="Anonymous final"
            hint="hide who wrote each final answer until the reveal"
            on={room.settings.anonymousFinal}
            disabled={!isLeader}
            onChange={(anonymousFinal) => set({ anonymousFinal })}
          />
        )}
        <Toggle
          label="Audience"
          hint="late joiners and a full room watch and vote"
          on={room.settings.audience}
          disabled={!isLeader}
          onChange={(audience) => set({ audience })}
        />
        <div className="row row--between">
          <span>
            Seats
            <span className="dim small setting__hint">
              players before the rest join the audience
            </span>
          </span>
          <div className="stepper" role="group" aria-label="Seats">
            <button
              className="stepper__btn"
              type="button"
              aria-label="Fewer seats"
              disabled={!isLeader || seats <= LIMITS.MIN_PLAYERS}
              onClick={() => changeSeats(seats - 1)}
            >
              −
            </button>
            <span className="stepper__value display">{seats}</span>
            <button
              className="stepper__btn"
              type="button"
              aria-label="More seats"
              disabled={!isLeader || seats >= LIMITS.MAX_PLAYERS}
              onClick={() => changeSeats(seats + 1)}
            >
              +
            </button>
          </div>
        </div>
        {!isLeader && (
          <p className="dim small">Only {leader?.name ?? 'the leader'} can change settings.</p>
        )}
      </section>

      {custom && (
        <section className="card stack">
          <h2 className="display">Your prompts</h2>
          <p className="dim small">
            Anyone can add. A full game uses {promptsNeeded} prompts (2 per player + 1 final);
            anything missing comes from the classic bank. Nobody gets their own prompt.
          </p>
          <form className="row" onSubmit={addPrompt}>
            <input
              className="field grow"
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              maxLength={LIMITS.PROMPT_MAX_CHARS}
              placeholder="The worst thing to hear from…"
              aria-label="New prompt"
            />
            <button
              className="btn btn--small"
              type="submit"
              disabled={promptDraft.trim().length < 3}
            >
              Add
            </button>
          </form>
          <ul className="plist">
            {room.customPrompts.map((p) => {
              const author = room.players.find((x) => x.id === p.authorId);
              const canRemove = p.authorId === me || isLeader;
              return (
                <li key={p.id} className="plist__item">
                  <span className="plist__text">{p.text}</span>
                  <span className="plist__author dim small">{author?.name ?? '?'}</span>
                  {canRemove && (
                    <button
                      className="plist__remove"
                      type="button"
                      aria-label={`Remove prompt: ${p.text}`}
                      onClick={() => ctl.removePrompt(p.id)}
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
            {room.customPrompts.length === 0 && <li className="dim small">No prompts yet.</li>}
          </ul>
          <span className="dim small">
            {room.customPrompts.length} / {promptsNeeded}
          </span>
        </section>
      )}

      <div className="startbar">
        <button className="btn btn--ghost btn--small" type="button" onClick={() => ctl.leaveRoom()}>
          Leave
        </button>
        {isLeader && !watching ? (
          <button
            className="btn"
            type="button"
            disabled={room.players.length < LIMITS.MIN_PLAYERS}
            onClick={() => {
              sfx.tap();
              ctl.startGame();
            }}
          >
            {room.players.length < LIMITS.MIN_PLAYERS
              ? `Need ${LIMITS.MIN_PLAYERS - room.players.length} more player${LIMITS.MIN_PLAYERS - room.players.length === 1 ? '' : 's'}`
              : 'Start Game'}
          </button>
        ) : (
          <div className="startbar__wait">Waiting for {leader?.name ?? 'the leader'} to start…</div>
        )}
      </div>
    </main>
  );
}

interface ToggleProps {
  label: string;
  hint: string;
  on: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}

function Toggle({ label, hint, on, disabled, onChange }: ToggleProps) {
  return (
    <div className="row row--between">
      <span>
        {label}
        <span className="dim small setting__hint">{hint}</span>
      </span>
      <button
        className={`toggle ${on ? 'toggle--on' : ''}`}
        type="button"
        disabled={disabled}
        aria-pressed={on}
        aria-label={label}
        onClick={() => onChange(!on)}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  options: { id: T; name: string }[];
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="segs" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={`seg ${value === option.id ? 'seg--on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(option.id)}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}
