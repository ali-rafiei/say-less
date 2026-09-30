import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Prompt, RoundIndex } from './shared.ts';

export interface PromptBankFile {
  prompts: Prompt[];
}

interface PackFile {
  id: string;
  prompts: Prompt[];
}

/** Doodle suggestions and Out of Context questions: dealt one per player per round. */
export interface SeedBanks {
  doodles: string[];
  questions: string[];
}

export class PromptDeck {
  private readonly prompts: readonly Prompt[];

  constructor(
    prompts: readonly Prompt[],
    private readonly random: () => number = Math.random,
  ) {
    if (prompts.length === 0) throw new Error('Prompt bank is empty');
    const ids = new Set<string>();
    for (const prompt of prompts) {
      if (ids.has(prompt.id)) throw new Error(`Duplicate prompt id ${prompt.id}`);
      ids.add(prompt.id);
    }
    this.prompts = prompts;
  }

  static fromFile(path: string, random?: () => number): PromptDeck {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as PromptBankFile;
    return new PromptDeck(parsed.prompts, random);
  }

  /** The classic bank plus every `packs/<id>.json` beside it, each prompt tagged with its pack. */
  static fromContent(bankPath: string, random?: () => number): PromptDeck {
    const classic = (JSON.parse(readFileSync(bankPath, 'utf8')) as PromptBankFile).prompts;
    const packDir = join(bankPath, '..', 'packs');
    const packed = existsSync(packDir)
      ? readdirSync(packDir)
          .filter((file) => file.endsWith('.json'))
          .flatMap((file) => {
            const pack = JSON.parse(readFileSync(join(packDir, file), 'utf8')) as PackFile;
            return pack.prompts.map((prompt) => ({ ...prompt, pack: pack.id }));
          })
      : [];
    return new PromptDeck([...classic.map((p) => ({ ...p, pack: 'classic' })), ...packed], random);
  }

  get size(): number {
    return this.prompts.length;
  }

  /**
   * Draw `count` prompts from `packs` tagged for `round`, never repeating an id in `used`.
   * Falls back to untagged unused prompts, then to reuse, so a long rematch
   * session never fails to deal. No packs (or none that exist) means every prompt.
   */
  draw(round: RoundIndex, count: number, used: Set<string>, packs?: readonly string[]): Prompt[] {
    const chosen = packs ? this.prompts.filter((p) => packs.includes(p.pack ?? 'classic')) : [];
    const pool = chosen.length > 0 ? chosen : this.prompts;
    const tagged = this.shuffle(pool.filter((p) => p.rounds.includes(round) && !used.has(p.id)));
    const picked = tagged.slice(0, count);
    if (picked.length < count) {
      const pickedIds = new Set(picked.map((p) => p.id));
      const anyUnused = this.shuffle(pool.filter((p) => !used.has(p.id) && !pickedIds.has(p.id)));
      picked.push(...anyUnused.slice(0, count - picked.length));
    }
    if (picked.length < count) {
      const pickedIds = new Set(picked.map((p) => p.id));
      const recycled = this.shuffle(pool.filter((p) => !pickedIds.has(p.id)));
      picked.push(...recycled.slice(0, count - picked.length));
    }
    for (const prompt of picked) used.add(prompt.id);
    return picked;
  }

  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }
}

export function loadSeedBanks(contentDir: string): SeedBanks {
  const read = <T>(file: string): T =>
    JSON.parse(readFileSync(join(contentDir, file), 'utf8')) as T;
  return {
    doodles: read<{ prompts: { text: string }[] }>('doodles.json').prompts.map((p) => p.text),
    questions: read<{ questions: { text: string }[] }>('questions.json').questions.map(
      (q) => q.text,
    ),
  };
}
