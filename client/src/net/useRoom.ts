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
  /** My own roast token count (public state only updates it between rounds). */
  myRoastTokens: number;
  roastedBy: string | null;
  error: UiError | null;
  /** serverNow - Date.now(); add to local time to compare with server deadlines */
  clockOffset: number;
  rejoining: boolean;
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  leaveRoom: () => void;
  /** Forget the stored session and show the home screen (escape hatch while rejoining). */
  startOver: () => void;
  /** false until the first successful connection of this page load */
  everConnected: boolean;
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
  const [myRoastTokens, setMyRoastTokens] = useState(1);
  const [roastedBy, setRoastedBy] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [rejoining, setRejoining] = useState(() => loadSession() !== null);
  const nameRef = useRef<string>(loadSession()?.name ?? '');
  const phaseRef = useRef<string | null>(null);
  const roomRef = useRef<PublicRoomState | null>(null);
  const joiningRef = useRef(false);
  const [everConnected, setEverConnected] = useState(false);

  useEffect(() => {
    const socket = new GameSocket(defaultSocketUrl());
    socketRef.current = socket;
    const offStatus = socket.onStatus((next) => {
      setStatus(next);
      if (next === 'open') {
        setEverConnected(true);
        const session = loadSession();
        if (session) {
          setRejoining(true);
          joiningRef.current = true;
          socket.sendNow({
            type: 'join_room',
            payload: { code: session.code, name: session.name, sessionToken: session.sessionToken },
          });
        }
      }
    });
    const offMessage = socket.onMessage((message) => {
      switch (message.type) {
        case 'welcome': {
          joiningRef.current = false;
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
          roomRef.current = state;
          setRoom(state);
          return;
        }
        case 'your_prompts':
          setPrompts(message.payload.prompts);
          setMyRoastTokens(message.payload.roastTokens);
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
          roomRef.current = null;
          setRoom(null);
          setMe(null);
          setPrompts([]);
          setMyPrompts({});
          return;
        case 'error': {
          const { code, message: text } = message.payload;
          if (joiningRef.current && (code === 'not_found' || code === 'bad_phase')) {
            // The stored room is gone or no longer joinable: back to home, quietly.
            joiningRef.current = false;
            clearSession();
            setRejoining(false);
            roomRef.current = null;
            setRoom(null);
            setMe(null);
            if (code === 'bad_phase') setError({ code, message: text, at: Date.now() });
            return;
          }
          joiningRef.current = false;
          if (code === 'rate_limited') return; // the socket paces sends; a stray one is harmless
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
      | 'myRoastTokens'
      | 'roastedBy'
      | 'error'
      | 'clockOffset'
      | 'rejoining'
      | 'everConnected'
    >
  >(
    () => ({
      createRoom: (name) => {
        nameRef.current = name;
        saveName(name);
        joiningRef.current = true;
        send({ type: 'create_room', payload: { name } });
      },
      joinRoom: (code, name) => {
        nameRef.current = name;
        saveName(name);
        joiningRef.current = true;
        send({ type: 'join_room', payload: { code, name } });
      },
      startOver: () => {
        clearSession();
        joiningRef.current = false;
        setRejoining(false);
        roomRef.current = null;
        setRoom(null);
        setMe(null);
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

  return {
    status,
    room,
    me,
    prompts,
    myPrompts,
    myRoastTokens,
    roastedBy,
    error,
    clockOffset,
    rejoining,
    everConnected,
    ...api,
  };
}
