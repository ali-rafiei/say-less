import { LIMITS, type EmojiFinalSetting, type PublicRoomState } from '@say-less/shared';
import { useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { PlayerChip } from '../components/PlayerChip.tsx';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

export function Lobby({ ctl, room, me }: Props) {
  const isLeader = room.leaderId === me;
  const leader = room.players.find((p) => p.id === room.leaderId);
  const [copied, setCopied] = useState(false);
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

  const emojiOptions: { value: EmojiFinalSetting; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'sometimes', label: '30%' },
    { value: 'always', label: 'Always' },
  ];

  return (
    <main className="screen lobby">
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
            <PlayerChip
              key={p.id}
              player={p}
              isLeader={p.id === room.leaderId}
              isMe={p.id === me}
              size={56}
            />
          ))}
          {Array.from({ length: Math.max(LIMITS.MIN_PLAYERS - room.players.length, 0) }, (_, i) => (
            <div key={`empty-${i}`} className="pchip pchip--empty">
              <div className="pchip__avatar pchip__avatar--empty">?</div>
              <span className="pchip__name dim">waiting…</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2 className="display">Settings</h2>
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
          <span>Emoji final round</span>
          <div className="seg">
            {emojiOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`seg__btn ${room.settings.emojiFinal === opt.value ? 'seg__btn--on' : ''}`}
                disabled={!isLeader}
                onClick={() => {
                  sfx.tap();
                  ctl.updateSettings({ emojiFinal: opt.value });
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {!isLeader && (
          <p className="dim small">Only {leader?.name ?? 'the leader'} can change settings.</p>
        )}
      </section>

      {isLeader ? (
        <button
          className="btn btn--block"
          type="button"
          disabled={room.players.length < LIMITS.MIN_PLAYERS}
          onClick={() => {
            sfx.tap();
            ctl.startGame();
          }}
        >
          {room.players.length < LIMITS.MIN_PLAYERS
            ? `Need ${LIMITS.MIN_PLAYERS - room.players.length} more`
            : 'Start Game'}
        </button>
      ) : (
        <p className="center dim">Waiting for {leader?.name ?? 'the leader'} to start…</p>
      )}
      <button className="btn btn--ghost btn--small" type="button" onClick={() => ctl.leaveRoom()}>
        Leave room
      </button>
    </main>
  );
}
