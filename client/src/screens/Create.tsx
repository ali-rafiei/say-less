import { UIArt } from '../components/UIArt.tsx';
import {
  encodeDrawing,
  isBlankDrawing,
  type Drawing,
  type PublicRoomState,
} from '@say-less/shared';
import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { Character } from '../components/Character.tsx';
import { DrawPad } from '../components/DrawPad.tsx';
import { Header } from '../components/Header.tsx';
import { PlayerChip } from '../components/PlayerChip.tsx';
import { WordInput } from '../components/WordInput.tsx';
import type { RoomController } from '../net/useRoom.ts';

interface Props {
  ctl: RoomController;
  room: PublicRoomState;
  me: string;
}

const EMPTY: Drawing = { strokes: [] };

/** Doodle: draw your secret suggestion. Burn Book: answer a question about yourself, honestly. */
export function Create({ ctl, room, me }: Props) {
  const task = ctl.prompts.find((p) => p.kind === 'draw' || p.kind === 'confess');
  const done = task ? task.submittedText !== null : room.submittedIds.includes(me);
  const myPlayer = room.players.find((p) => p.id === me);

  return (
    <main className="screen create">
      <Header room={room} clockOffset={ctl.clockOffset} />
      {task && !done ? (
        task.kind === 'draw' ? (
          <DrawTask
            key={task.promptId}
            ctl={ctl}
            draftKey={`${room.code}.${task.promptId}`}
            promptId={task.promptId}
            suggestion={task.text}
          />
        ) : (
          <section className="card stack">
            <span className="dim small">Only you see this question. Be honest.</span>
            <h2 className="prompt display">{task.text}</h2>
            <WordInput
              key={task.promptId}
              draftKey={`${room.code}.${task.promptId}`}
              limit={task.effectiveLimit}
              resetToken={ctl.error?.at ?? null}
              autoFocus
              placeholder="The honest truth…"
              onSubmit={(text) => ctl.submitAnswer(task.promptId, text)}
            />
            <p className="dim small">
              Everyone else will see your answer and try to make you look bad.
            </p>
          </section>
        )
      ) : (
        <section className="card stack center waitroom">
          <h2 className="display">
            <UIArt name="pencil" /> {room.submittedIds.length} of {room.players.length} done
          </h2>
          <div className="pgrid">
            {room.players.map((p) => {
              const finished = room.submittedIds.includes(p.id);
              return (
                <PlayerChip
                  key={p.id}
                  player={p}
                  state={finished ? 'waiting' : 'writing'}
                  size={56}
                  badge={finished ? 'done' : null}
                />
              );
            })}
          </div>
          <p className="dim small">
            {room.settings.mode === 'doodle'
              ? 'Still drawing: the ones with pencils.'
              : 'Still confessing: the ones with pencils.'}
          </p>
          <Character characterId={myPlayer?.characterId ?? null} state="idle" size={84} />
        </section>
      )}
    </main>
  );
}

interface DrawTaskProps {
  ctl: RoomController;
  draftKey: string;
  promptId: string;
  suggestion: string;
}

function DrawTask({ ctl, draftKey, promptId, suggestion }: DrawTaskProps) {
  const [drawing, setDrawing] = useState<Drawing>(() => loadDraft(draftKey));
  const [pending, setPending] = useState(false);
  useEffect(() => setPending(false), [ctl.error?.at]);
  const blank = isBlankDrawing(drawing);

  function change(next: Drawing) {
    setDrawing(next);
    storeDraft(draftKey, next);
  }

  return (
    <section className="card stack create__draw">
      <h2 className="prompt display">Secretly draw: {suggestion}</h2>
      <DrawPad value={drawing} onChange={change} disabled={pending} />
      {/* Pinned to the bottom so it never needs a scroll away from the canvas. */}
      <div className="startbar">
        <button
          className="btn btn--block"
          type="button"
          disabled={blank || pending}
          onClick={() => {
            sfx.tap();
            setPending(true);
            ctl.submitDrawing(promptId, encodeDrawing(drawing));
          }}
        >
          {pending ? 'Sending…' : blank ? 'Draw something first' : 'Done drawing'}
        </button>
      </div>
    </section>
  );
}

function loadDraft(key: string): Drawing {
  try {
    const raw = sessionStorage.getItem(`say-less.drawing.${key}`);
    const parsed = raw ? (JSON.parse(raw) as Partial<Drawing>) : null;
    return Array.isArray(parsed?.strokes) ? { strokes: parsed.strokes } : EMPTY;
  } catch {
    // storage unavailable or a corrupt draft: start fresh
    return EMPTY;
  }
}

function storeDraft(key: string, drawing: Drawing): void {
  try {
    sessionStorage.setItem(`say-less.drawing.${key}`, JSON.stringify(drawing));
  } catch {
    // storage unavailable: the draft just does not survive a refresh
  }
}
