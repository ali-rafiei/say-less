import type { SiteId } from './sites.ts';

export type RoomPhase =
  | 'LOBBY'
  | 'ROUND_INTRO'
  /** Doodle and Out of Context only: everyone draws, or answers about themselves, before writing */
  | 'CREATING'
  | 'WRITING'
  | 'VOTING'
  | 'MATCHUP_REVEAL'
  | 'ROUND_RESULTS'
  | 'FINAL_WRITING'
  | 'FINAL_VOTING'
  | 'FINAL_REVEAL'
  | 'PODIUM';

export type RoundIndex = 0 | 1 | 2;

/**
 * classic: prompts from the chosen packs. custom: players write the prompts in the lobby.
 * doodle: everyone draws, then captions each other's drawings.
 * context: after Survive the Internet. Everyone answers a question honestly, another player
 *   gets only that quote and writes the headline (or product, or thread) that makes it look
 *   ridiculous, and everyone votes once on the wall of posts. Every round is a wall round.
 */
export type GameMode = 'classic' | 'custom' | 'doodle' | 'context';

export interface RoomSettings {
  profanityFilter: boolean;
  /** false lifts every word limit; a roast still cuts its target to 2 words */
  wordLimits: boolean;
  /** 'custom' deals player-written prompts first and fills any shortfall from the packs */
  mode: GameMode;
  /** prompt pack ids (see PACKS) the bank draws from */
  packs: string[];
  /** false skips the round 2 roast window, so nobody can cut an opponent to 2 words */
  roasts: boolean;
}

export interface CustomPrompt {
  id: string;
  text: string;
  authorId: string;
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
  /** null until revealed, and when word limits are off */
  effectiveLimit: number | null;
  /** Out of Context: the post this answer is the twist for */
  seed: PublicSeed | null;
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

/** What a Doodle or Out of Context prompt is built on. */
export type PublicSeed =
  | {
      kind: 'drawing';
      /** fetch the strokes from the `drawings` message */
      drawingId: string;
      /** null until the matchup (or final) is revealed */
      artistId: string | null;
    }
  | {
      kind: 'post';
      /** vote with this id: the twister stays anonymous until the reveal */
      postId: string;
      victimId: string;
      quote: string;
      site: SiteId;
      /** null until revealed */
      twisterId: string | null;
    };

export interface Roast {
  spenderId: string;
  targetId: string;
}

export interface PublicMatchup {
  promptId: string;
  promptText: string;
  /** null until voting opens, and in Classic and Custom */
  seed: PublicSeed | null;
  answers: [PublicAnswer, PublicAnswer];
  votes: Record<string, 0 | 1> | null;
  roast: Roast | null;
  result: MatchupResult | null;
  revealed: boolean;
}

export interface FinalTally {
  /** first-choice votes, or in Out of Context every vote on this player's twist */
  first: number;
  second: number;
  /** points for this player's answer (or twist) */
  points: number;
  /** Out of Context: points for being the victim of the posts people voted for */
  pity: number;
  /** Out of Context: this player's twist drew the most votes */
  bestBurn: boolean;
}

export interface PublicFinal {
  prompt: { id: string; text: string };
  seed: PublicSeed | null;
  /** rank: pick your top two. single: one vote (Out of Context). */
  voting: 'rank' | 'single';
  /** null when word limits are off */
  limit: number | null;
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
  customPrompts: CustomPrompt[];
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
  /** answer: write under the limit. draw / confess: the CREATING task for Doodle / Out of Context. */
  kind: 'answer' | 'draw' | 'confess';
  promptId: string;
  text: string;
  seed: PublicSeed | null;
  /** null when word limits are off */
  effectiveLimit: number | null;
  matchupIndex: number | null;
  submittedText: string | null;
}

export interface Prompt {
  id: string;
  text: string;
  rounds: RoundIndex[];
  /** pack id; the classic bank when absent */
  pack?: string;
}
