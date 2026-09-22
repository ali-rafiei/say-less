export type RoomPhase =
  | 'LOBBY'
  | 'CHAR_SELECT'
  | 'ROUND_INTRO'
  | 'WRITING'
  | 'VOTING'
  | 'MATCHUP_REVEAL'
  | 'ROUND_RESULTS'
  | 'FINAL_WRITING'
  | 'FINAL_VOTING'
  | 'PODIUM';

export type RoundIndex = 0 | 1 | 2;
export type AnswerMode = 'words' | 'emoji';
export type EmojiFinalSetting = 'off' | 'sometimes' | 'always';

export interface RoomSettings {
  profanityFilter: boolean;
  emojiFinal: EmojiFinalSetting;
}

export interface PlayerStats {
  micDrops: number;
  silenced: number;
  roasted: number;
  wordsUsedTotal: number;
  submissions: number;
  submitMsTotal: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  characterId: string | null;
  connected: boolean;
  score: number;
  roastTokens: number;
  stats: PlayerStats;
  joinedAt: number;
}

export interface PublicAnswer {
  /** null until the matchup is revealed */
  playerId: string | null;
  /** null until voting opens */
  text: string | null;
  wordCount: number | null;
  autoSubmitted: boolean;
  effectiveLimit: number | null;
}

export type AwardKind = 'votes' | 'silenced' | 'micDrop' | 'greatMinds' | 'steal' | 'stolen';

export interface PlayerAward {
  playerId: string;
  kind: AwardKind;
  points: number;
}

export interface MatchupResult {
  voteCounts: [number, number];
  winnerIndex: 0 | 1 | null;
  tie: boolean;
  greatMinds: boolean;
  awards: PlayerAward[];
  /** net score change per player id for this matchup */
  delta: Record<string, number>;
}

export interface Roast {
  spenderId: string;
  targetId: string;
}

export interface PublicMatchup {
  promptId: string;
  promptText: string;
  answers: [PublicAnswer, PublicAnswer];
  votes: Record<string, 0 | 1> | null;
  roast: Roast | null;
  result: MatchupResult | null;
  revealed: boolean;
}

export interface FinalTally {
  first: number;
  second: number;
  points: number;
}

export interface PublicFinal {
  prompt: { id: string; text: string };
  mode: AnswerMode;
  limit: number;
  answers: PublicAnswer[];
  votes: Record<string, [string, string]> | null;
  result: Record<string, FinalTally> | null;
}

export interface PodiumPlacement {
  playerId: string;
  place: number;
  score: number;
}

export interface Superlative {
  title: string;
  playerId: string;
  detail: string;
}

export interface Podium {
  placements: PodiumPlacement[];
  superlatives: Superlative[];
}

export interface PublicRoomState {
  code: string;
  phase: RoomPhase;
  phaseEndsAt: number | null;
  phaseStartedAt: number;
  roundIndex: RoundIndex;
  players: PublicPlayer[];
  leaderId: string;
  settings: RoomSettings;
  matchups: PublicMatchup[];
  currentMatchupIndex: number;
  roastWindowEndsAt: number | null;
  submittedIds: string[];
  votedIds: string[];
  final: PublicFinal | null;
  podium: Podium | null;
  banner: string | null;
  gamesPlayed: number;
  /** server clock at broadcast time, so clients can offset their countdown rings */
  serverNow: number;
}

export interface YourPrompt {
  promptId: string;
  text: string;
  effectiveLimit: number;
  mode: AnswerMode;
  matchupIndex: number | null;
  submittedText: string | null;
}

export interface Prompt {
  id: string;
  text: string;
  rounds: RoundIndex[];
}
