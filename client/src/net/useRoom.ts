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

const TAB_CHANNEL = 'say-less.seat';

interface SeatClaim {
  sessionToken: string;
  at: number;
}

export interface UiError {
  code: ErrorCode | 'offline';
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
  /** Another tab of this browser took over the seat. */
  displaced: boolean;
  /** Take the seat back from the other tab. */
  playHere: () => void;
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
  // Out of a room (left, kicked, room gone) the music goes back to the home groove.
  useEffect(() => {
    if (room) return;
    phaseRef.current = null;
    sfx.phase(null);
  }, [room]);
  const roomRef = useRef<PublicRoomState | null>(null);
  const joiningRef = useRef<'join' | 'rejoin' | null>(null);
  const inflightRef = useRef(new Set<string>());
  const tokenRef = useRef<string | null>(null);
  const claimedAtRef = useRef(0);
  const [displaced, setDisplaced] = useState(false);
  const [everConnected, setEverConnected] = useState(false);

  useEffect(() => {
    const socket = new GameSocket(defaultSocketUrl());
    socketRef.current = socket;
    const tabs = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(TAB_CHANNEL);
    if (tabs) {
      tabs.onmessage = (event: MessageEvent<SeatClaim>) => {
        const claim = event.data;
        if (claim.sessionToken !== tokenRef.current || claim.at < claimedAtRef.current) return;
        socket.close();
        setDisplaced(true);
      };
    }
    const offStatus = socket.onStatus((next) => {
      setStatus(next);
      inflightRef.current.clear();
      if (next === 'open') {
        setEverConnected(true);
        const session = loadSession();
        if (session) {
          setRejoining(true);
          joiningRef.current = 'rejoin';
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
          joiningRef.current = null;
          inflightRef.current.clear();
          tokenRef.current = message.payload.sessionToken;
          claimedAtRef.current = Date.now();
          tabs?.postMessage({
            sessionToken: message.payload.sessionToken,
            at: claimedAtRef.current,
          } satisfies SeatClaim);
          setDisplaced(false);
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
            inflightRef.current.clear();
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
          inflightRef.current.clear();
          clearSession();
          roomRef.current = null;
          setRoom(null);
          setMe(null);
          setPrompts([]);
          setMyPrompts({});
          return;
        case 'error': {
          const { code, message: text } = message.payload;
          inflightRef.current.clear();
          if (joiningRef.current === 'rejoin' && (code === 'not_found' || code === 'bad_phase')) {
            // The stored room is gone or no longer joinable: back to home, quietly on a fresh load.
            const wasPlaying = roomRef.current !== null;
            joiningRef.current = null;
            clearSession();
            setRejoining(false);
            roomRef.current = null;
            setRoom(null);
            setMe(null);
            if (code === 'bad_phase') setError({ code, message: text, at: Date.now() });
            else if (wasPlaying) setError({ code, message: 'That room is gone.', at: Date.now() });
            return;
          }
          joiningRef.current = null;
          if (code === 'rate_limited') return; // the socket paces sends; a stray one is harmless
          setError({ code, message: text, at: Date.now() });
          sfx.error();
          return;
        }
        default:
          return;
      }
    });
    const offDrop = socket.onDrop(() => {
      inflightRef.current.clear();
      setError({ code: 'offline', message: 'Connection lost. Try that again.', at: Date.now() });
    });
    socket.connect();
    return () => {
      offStatus();
      offMessage();
      offDrop();
      tabs?.close();
      socket.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => socketRef.current?.send(message), []);
  /** Once-per-phase intents: a double-tap must not become a second, rejected intent. */
  const sendOnce = useCallback(
    (key: string, message: ClientMessage) => {
      if (inflightRef.current.has(key)) return;
      inflightRef.current.add(key);
      send(message);
    },
    [send],
  );

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
      | 'displaced'
      | 'everConnected'
    >
  >(
    () => ({
      createRoom: (name) => {
        nameRef.current = name;
        saveName(name);
        joiningRef.current = 'join';
        sendOnce('join', { type: 'create_room', payload: { name } });
      },
      joinRoom: (code, name) => {
        nameRef.current = name;
        saveName(name);
        joiningRef.current = 'join';
        sendOnce('join', { type: 'join_room', payload: { code, name } });
      },
      playHere: () => {
        setDisplaced(false);
        if (!loadSession()) {
          roomRef.current = null;
          setRoom(null);
          setMe(null);
        }
        socketRef.current?.connect();
      },
      startOver: () => {
        clearSession();
        joiningRef.current = null;
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
      startGame: () => sendOnce('start_game', { type: 'start_game', payload: {} }),
      pickCharacter: (characterId) => send({ type: 'pick_character', payload: { characterId } }),
      addPrompt: (text) => send({ type: 'add_prompt', payload: { text } }),
      removePrompt: (promptId) => send({ type: 'remove_prompt', payload: { promptId } }),
      spendRoast: (targetId) => send({ type: 'spend_roast', payload: { targetId } }),
      submitAnswer: (promptId, text) =>
        send({ type: 'submit_answer', payload: { promptId, text } }),
      castVote: (matchupIndex, answerIndex) =>
        sendOnce('cast_vote', { type: 'cast_vote', payload: { matchupIndex, answerIndex } }),
      castFinalVotes: (first, second) =>
        sendOnce('cast_final_votes', { type: 'cast_final_votes', payload: { first, second } }),
      rematch: () => sendOnce('rematch', { type: 'rematch', payload: {} }),
      dismissError: () => setError(null),
    }),
    [send, sendOnce],
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
    displaced,
    everConnected,
    ...api,
  };
}
