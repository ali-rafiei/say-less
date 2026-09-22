import type { PublicRoomState, RoomSettings, YourPrompt } from './types.ts';

export type ErrorCode =
  | 'over_limit'
  | 'already_roasted'
  | 'char_taken'
  | 'bad_phase'
  | 'room_full'
  | 'not_found'
  | 'rate_limited'
  | 'invalid'
  | 'not_leader'
  | 'bad_name'
  | 'not_enough_players'
  | 'too_long'
  | 'invalid_chars'
  | 'empty'
  | 'self_target'
  | 'no_token'
  | 'already_submitted';

export type ClientMessage =
  | { type: 'create_room'; payload: { name: string } }
  | { type: 'join_room'; payload: { code: string; name: string; sessionToken?: string } }
  | { type: 'update_settings'; payload: Partial<RoomSettings> }
  | { type: 'start_game'; payload: Record<string, never> }
  | { type: 'pick_character'; payload: { characterId: string } }
  | { type: 'add_prompt'; payload: { text: string } }
  | { type: 'remove_prompt'; payload: { promptId: string } }
  | { type: 'spend_roast'; payload: { targetId: string } }
  | { type: 'submit_answer'; payload: { promptId: string; text: string } }
  | { type: 'cast_vote'; payload: { matchupIndex: number; answerIndex: 0 | 1 } }
  | { type: 'cast_final_votes'; payload: { first: string; second: string } }
  | { type: 'rematch'; payload: Record<string, never> }
  | { type: 'leave_room'; payload: Record<string, never> }
  | { type: 'ping'; payload: Record<string, never> };

export type ClientMessageType = ClientMessage['type'];

export interface RevealPayload {
  matchupIndex: number;
}

export type ServerMessage =
  | { type: 'welcome'; payload: { playerId: string; sessionToken: string; code: string } }
  | { type: 'room_state'; payload: PublicRoomState }
  | { type: 'your_prompts'; payload: { prompts: YourPrompt[] } }
  | { type: 'roasted'; payload: { byName: string } }
  | { type: 'reveal'; payload: RevealPayload }
  | { type: 'error'; payload: { code: ErrorCode; message: string } }
  | { type: 'left'; payload: Record<string, never> }
  | { type: 'pong'; payload: { serverTime: number } };

export const CLIENT_MESSAGE_TYPES: readonly ClientMessageType[] = [
  'create_room',
  'join_room',
  'update_settings',
  'start_game',
  'pick_character',
  'add_prompt',
  'remove_prompt',
  'spend_roast',
  'submit_answer',
  'cast_vote',
  'cast_final_votes',
  'rematch',
  'leave_room',
  'ping',
];
