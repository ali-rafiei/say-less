import { UIArt } from '../components/UIArt.tsx';
import { SoundControls } from '../components/SoundControls.tsx';
import { CHARACTERS, LIMITS, PACKS, type GameMode, type PublicRoomState } from '@say-less/shared';
import { useState, type FormEvent } from 'react';
import { sfx } from '../audio/sfx.ts';
import { Character } from '../components/Character.tsx';
import { PlayerChip } from '../components/PlayerChip.tsx';
import type { RoomController } from '../net/useRoom.ts';

const MODES: { id: GameMode; name: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic', blurb: 'Answer prompts from the packs' },
  { id: 'custom', name: 'Custom', blurb: 'Everyone writes the prompts' },
  { id: 'doodle', name: 'Doodle', blurb: 'Draw, then caption the art' },
  { id: 'burn', name: 'Burn Book', blurb: 'Tell the truth, get roasted' },
];

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

export function Lobby({ ctl, room, me }: Props) {
  const isLeader = room.leaderId === me;
  const leader = room.players.find((p) => p.id === room.leaderId);
  const mine = room.players.find((p) => p.id === me)?.characterId ?? null;
  const [copied, setCopied] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const custom = room.settings.mode === 'custom';
  const usesPacks = room.settings.mode === 'classic' || custom;
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

      <section className="card stack">
        <div className="row row--between">
          <h2 className="display">Players</h2>
          <span className="dim">
            {room.players.length} / {LIMITS.MAX_PLAYERS}
          </span>
        </div>
        <div className="pgrid">
          {room.players.map((p) => (
            <PlayerChip key={p.id} player={p} isLeader={p.id === room.leaderId} size={56} />
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
        {isLeader ? (
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
