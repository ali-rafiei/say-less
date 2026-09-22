import type {
  ClientMessage,
  ErrorCode,
  PublicRoomState,
  RoomSettings,
  YourPrompt,
} from '@say-less/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { clearSession, loadSession, saveName, saveSession } from './session.ts';
import { GameSocket, defaultSocketUrl, type SocketStatus } from './socket.ts';

export interface UiError {
  code: ErrorCode;
  message: string;
  at: number;
}

export interface RoomController {
  status: SocketStatus;
  room: PublicRoomState | null;
  me: string | null;
  prompts: YourPrompt[];
  /** Every prompt dealt to me this round (promptId -> my answer or null), kept through voting. */
  myPrompts: Record<string, string | null>;
  roastedBy: string | null;
  error: UiError | null;
  /** serverNow - Date.now(); add to local time to compare with server deadlines */
  clockOffset: number;
  rejoining: boolean;
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  leaveRoom: () => void;
  updateSettings: (patch: Partial<RoomSettings>) => void;
  startGame: () => void;
  pickCharacter: (characterId: string) => void;
  addPrompt: (text: string) => void;
  removePrompt: (promptId: string) => void;
  spendRoast: (targetId: string) => void;
  submitAnswer: (promptId: string, text: string) => void;
  castVote: (matchupIndex: number, answerIndex: 0 | 1) => void;
  castFinalVotes: (first: string, second: string) => void;
  rematch: () => void;
  dismissError: () => void;
}

export function useRoom(): RoomController {
  const socketRef = useRef<GameSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<YourPrompt[]>([]);
  const [myPrompts, setMyPrompts] = useState<Record<string, string | null>>({});
  const [roastedBy, setRoastedBy] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [rejoining, setRejoining] = useState(() => loadSession() !== null);
  const nameRef = useRef<string>(loadSession()?.name ?? '');
  const phaseRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = new GameSocket(defaultSocketUrl());
    socketRef.current = socket;
    const offStatus = socket.onStatus((next) => {
      setStatus(next);
      if (next === 'open') {
        const session = loadSession();
        if (session) {
          setRejoining(true);
          socket.send({
            type: 'join_room',
            payload: { code: session.code, name: session.name, sessionToken: session.sessionToken },
          });
        }
      }
    });
    const offMessage = socket.onMessage((message) => {
      switch (message.type) {
        case 'welcome': {
          setMe(message.payload.playerId);
          setRejoining(false);
          saveSession({
            code: message.payload.code,
            sessionToken: message.payload.sessionToken,
            name: nameRef.current,
          });
          return;
        }
        case 'room_state': {
          const state = message.payload;
          setClockOffset(state.serverNow - Date.now());
          if (phaseRef.current !== state.phase) {
            phaseRef.current = state.phase;
            if (state.phase !== 'WRITING' && state.phase !== 'FINAL_WRITING') {
              setPrompts([]);
              setRoastedBy(null);
            }
            if (state.phase === 'ROUND_INTRO' || state.phase === 'LOBBY') {
              setMyPrompts({});
            }
            sfx.phase(state.phase);
          }
          setRoom(state);
          return;
        }
        case 'your_prompts':
          setPrompts(message.payload.prompts);
          setMyPrompts((current) => {
            const next = { ...current };
            for (const p of message.payload.prompts) next[p.promptId] = p.submittedText;
            return next;
          });
          return;
        case 'roasted':
          setRoastedBy(message.payload.byName);
          sfx.roast();
          return;
        case 'reveal':
          return;
        case 'left':
          clearSession();
          setRoom(null);
          setMe(null);
          setPrompts([]);
          setMyPrompts({});
          return;
        case 'error': {
          const { code, message: text } = message.payload;
          if (code === 'not_found' && loadSession()) {
            // Our stored room is gone; fall back to the home screen quietly.
            clearSession();
            setRejoining(false);
            setRoom(null);
            setMe(null);
            return;
          }
          if (code === 'bad_phase' && loadSession() && !room) {
            clearSession();
            setRejoining(false);
          }
          setError({ code, message: text, at: Date.now() });
          sfx.error();
          return;
        }
        default:
          return;
      }
    });
    socket.connect();
    return () => {
      offStatus();
      offMessage();
      socket.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => socketRef.current?.send(message), []);

  const api = useMemo<
    Omit<
      RoomController,
      | 'status'
      | 'room'
      | 'me'
      | 'prompts'
      | 'myPrompts'
      | 'roastedBy'
      | 'error'
      | 'clockOffset'
      | 'rejoining'
    >
  >(
    () => ({
      createRoom: (name) => {
        nameRef.current = name;
        saveName(name);
        send({ type: 'create_room', payload: { name } });
      },
      joinRoom: (code, name) => {
        nameRef.current = name;
        saveName(name);
        send({ type: 'join_room', payload: { code, name } });
      },
      leaveRoom: () => {
        send({ type: 'leave_room', payload: {} });
        clearSession();
        setRoom(null);
        setMe(null);
        setPrompts([]);
      },
      updateSettings: (patch) => send({ type: 'update_settings', payload: patch }),
      startGame: () => send({ type: 'start_game', payload: {} }),
      pickCharacter: (characterId) => send({ type: 'pick_character', payload: { characterId } }),
      addPrompt: (text) => send({ type: 'add_prompt', payload: { text } }),
      removePrompt: (promptId) => send({ type: 'remove_prompt', payload: { promptId } }),
      spendRoast: (targetId) => send({ type: 'spend_roast', payload: { targetId } }),
      submitAnswer: (promptId, text) =>
        send({ type: 'submit_answer', payload: { promptId, text } }),
      castVote: (matchupIndex, answerIndex) =>
        send({ type: 'cast_vote', payload: { matchupIndex, answerIndex } }),
      castFinalVotes: (first, second) =>
        send({ type: 'cast_final_votes', payload: { first, second } }),
      rematch: () => send({ type: 'rematch', payload: {} }),
      dismissError: () => setError(null),
    }),
    [send],
  );

  return { status, room, me, prompts, myPrompts, roastedBy, error, clockOffset, rejoining, ...api };
}
