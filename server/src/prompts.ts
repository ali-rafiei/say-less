import { readFileSync } from 'node:fs';
import type { Prompt, RoundIndex } from './shared.ts';

export interface PromptBankFile {
  prompts: Prompt[];
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

  get size(): number {
    return this.prompts.length;
  }

  /**
   * Draw `count` prompts tagged for `round`, never repeating an id in `used`.
   * Falls back to untagged unused prompts, then to reuse, so a long rematch
   * session never fails to deal.
   */
  draw(round: RoundIndex, count: number, used: Set<string>): Prompt[] {
    const tagged = this.shuffle(
      this.prompts.filter((p) => p.rounds.includes(round) && !used.has(p.id)),
    );
    const picked = tagged.slice(0, count);
    if (picked.length < count) {
      const pickedIds = new Set(picked.map((p) => p.id));
      const anyUnused = this.shuffle(
        this.prompts.filter((p) => !used.has(p.id) && !pickedIds.has(p.id)),
      );
      picked.push(...anyUnused.slice(0, count - picked.length));
    }
    if (picked.length < count) {
      const pickedIds = new Set(picked.map((p) => p.id));
      const recycled = this.shuffle(this.prompts.filter((p) => !pickedIds.has(p.id)));
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
