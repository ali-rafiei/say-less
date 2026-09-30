import {
  CHARACTER_IDS,
  DRAW_COLORS,
  DRAW_WIDTHS,
  encodeDrawing,
  words,
  type Drawing,
  type PublicRoomState,
  type ServerMessage,
  type YourPrompt,
} from './shared.ts';
import { RoomError, type Room } from './room.ts';

/** Joining with this code opens a fresh room seated with bots (real codes never contain an O). */
export const BOT_ROOM_CODE = 'BOTS';
const BOT_NAMES = ['Beep', 'Boop', 'Bleep', 'Blorp'];
const BOT_ANSWERS = [
  'my landlord',
  'a suspicious amount of cheese',
  'taxes, but louder',
  'whatever Gary did',
  'absolutely not',
  'a raccoon in a trench coat',
  'vibes',
  'three pigeons in a suit',
  'emotional damage',
  "my ex's playlist",
  'the forbidden soup',
  'a very long nap',
  'unpaid overtime',
  "grandma's search history",
  'a horse',
  'legally, nothing',
  'soggy cereal',
  'the group chat',
  'one sock',
  'free trial, never cancelled',
];

const BOT_CONFESSIONS = [
  'pineapple on everything',
  'I talk to my plants',
  'three alarms, minimum',
  'I still sleep with a teddy',
  'reality TV, all of it',
  'I cry at car adverts',
];

/** [min, max] think time before each kind of move, in ms */
const DELAYS = {
  answer: [3_000, 12_000],
  create: [4_000, 15_000],
  roast: [1_000, 6_000],
  vote: [1_500, 5_000],
  finalVote: [3_000, 8_000],
} as const satisfies Record<string, readonly [number, number]>;
const ROAST_CHANCE = 0.35;

/**
 * Server-side players for testing alone. They receive the same messages as a human and act
 * through the same room intents, after a random think time so the room never re-enters itself.
 */
export class BotCrew {
  private readonly botIds: string[] = [];
  private readonly prompts = new Map<string, YourPrompt[]>();
  /** one entry per move already scheduled, so repeated broadcasts do not repeat it */
  private readonly planned = new Set<string>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  /** games played and round index of the latest state, so rematches get fresh moves */
  private round = '';

  constructor(
    private readonly room: Room,
    private readonly random: () => number = Math.random,
  ) {}

  isBot(playerId: string): boolean {
    return this.botIds.includes(playerId);
  }

  seat(): void {
    BOT_NAMES.forEach((name, i) => {
      const id = `bot:${this.room.code}:${i}`;
      this.botIds.push(id);
      this.room.addPlayer(id, name, true);
      const taken = new Set(this.room.publicState().players.map((p) => p.characterId));
      const free = CHARACTER_IDS.filter((c) => !taken.has(c));
      const pick = free[Math.floor(this.random() * free.length)];
      if (pick) this.room.pickCharacter(id, pick);
    });
  }

  receive(botId: string, message: ServerMessage): void {
    if (message.type === 'your_prompts') this.onPrompts(botId, message.payload.prompts);
    else if (message.type === 'room_state') this.onState(botId, message.payload);
  }

  dispose(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  private onPrompts(botId: string, prompts: YourPrompt[]): void {
    this.prompts.set(botId, prompts);
    for (const prompt of prompts) {
      if (prompt.submittedText !== null) continue;
      const key = `${botId}:${this.round}:${prompt.kind}:${prompt.promptId}`;
      if (prompt.kind === 'draw') {
        this.plan(key, DELAYS.create, () =>
          this.room.submitDrawing(botId, prompt.promptId, encodeDrawing(this.scribble())),
        );
      } else if (prompt.kind === 'confess') {
        this.plan(key, DELAYS.create, () =>
          this.room.submitAnswer(botId, prompt.promptId, this.pick(BOT_CONFESSIONS)),
        );
      } else {
        this.plan(key, DELAYS.answer, () =>
          this.room.submitAnswer(botId, prompt.promptId, this.answer(prompt.effectiveLimit)),
        );
      }
    }
  }

  private onState(botId: string, state: PublicRoomState): void {
    this.round = `${state.gamesPlayed}:${state.roundIndex}`;
    const game = `${botId}:${this.round}`;
    if (state.phase === 'WRITING' && state.roastWindowEndsAt !== null) {
      const targets = state.players.filter((p) => p.id !== botId);
      this.plan(`${game}:roast`, DELAYS.roast, () => {
        if (this.random() < ROAST_CHANCE) this.room.spendRoast(botId, this.pick(targets).id);
      });
    } else if (state.phase === 'VOTING') {
      const index = state.currentMatchupIndex;
      const mine = this.prompts.get(botId)?.some((p) => p.matchupIndex === index) ?? false;
      if (mine || state.votedIds.includes(botId)) return;
      this.plan(`${game}:vote:${index}`, DELAYS.vote, () =>
        this.room.castVote(botId, index, this.random() < 0.5 ? 0 : 1),
      );
    } else if (state.phase === 'FINAL_VOTING' && state.final) {
      const others = state.final.answers.filter((a) => a.playerId !== null && a.playerId !== botId);
      if (others.length < 2 || state.votedIds.includes(botId)) return;
      const first = this.pick(others);
      const second = this.pick(others.filter((a) => a !== first));
      this.plan(`${game}:final`, DELAYS.finalVote, () =>
        this.room.castFinalVotes(botId, first.playerId!, second.playerId!),
      );
    }
  }

  private plan(key: string, [min, max]: readonly [number, number], move: () => void): void {
    if (this.planned.has(key)) return;
    this.planned.add(key);
    const timer = setTimeout(
      () => {
        this.timers.delete(timer);
        try {
          move();
        } catch (error) {
          // The phase moved on (timer ran out, target taken) before the bot got to it.
          if (!(error instanceof RoomError)) throw error;
        }
      },
      min + this.random() * (max - min),
    );
    this.timers.add(timer);
  }

  private answer(limit: number | null): string {
    const phrase = words(this.pick(BOT_ANSWERS));
    return phrase.slice(0, limit ?? phrase.length).join(' ');
  }

  /** A few wandering lines in random ink: enough to caption. */
  private scribble(): Drawing {
    const strokes = Array.from({ length: 3 + Math.floor(this.random() * 4) }, () => {
      let x = 40 + Math.floor(this.random() * 176);
      let y = 40 + Math.floor(this.random() * 176);
      const points: number[] = [];
      for (let i = 0; i < 12; i++) {
        points.push(x, y);
        x = Math.min(255, Math.max(0, x + Math.floor(this.random() * 41) - 20));
        y = Math.min(255, Math.max(0, y + Math.floor(this.random() * 41) - 20));
      }
      return {
        color: Math.floor(this.random() * (DRAW_COLORS.length - 1)),
        width: Math.floor(this.random() * DRAW_WIDTHS.length),
        points,
      };
    });
    return { strokes };
  }

  private pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)]!;
  }
}
