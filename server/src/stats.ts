import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface OnlineNow {
  /** connected players in seats, across every room */
  players: number;
  audience: number;
  rooms: number;
}

export interface DaySummary {
  date: string;
  players: number;
  visitors: number;
  gamesStarted: number;
  gamesFinished: number;
  peakOnline: number;
}

export interface StatsSummary {
  /** local date the counting began */
  since: string;
  timeZone: string;
  online: OnlineNow;
  totals: {
    /** distinct devices seated in a game that started */
    players: number;
    /** distinct devices that joined any room, the audience included */
    visitors: number;
    gamesStarted: number;
    gamesFinished: number;
    /** player seats summed over every started game */
    seats: number;
  };
  /** newest first */
  days: DaySummary[];
}

export interface PlayStatsOptions {
  /** null keeps everything in memory (tests, local dev without a data dir) */
  path: string | null;
  timeZone: string;
  retentionDays?: number;
  now?: () => number;
  saveDelayMs?: number;
  log?: (message: string, fields?: Record<string, unknown>) => void;
}

interface DayRecord {
  players: string[];
  visitors: string[];
  gamesStarted: number;
  gamesFinished: number;
  peakOnline: number;
}

interface StatsFile {
  version: 1;
  since: string;
  totals: { gamesStarted: number; gamesFinished: number; seats: number };
  players: string[];
  visitors: string[];
  days: Record<string, DayRecord>;
}

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_SAVE_DELAY_MS = 5_000;

/**
 * Play counts that survive restarts: all-time totals plus one row per local day.
 * Devices are anonymous random ids from the browser, stored only as short hashes.
 */
export class PlayStats {
  private readonly players: Set<string>;
  private readonly visitors: Set<string>;
  private readonly days = new Map<
    string,
    { players: Set<string>; visitors: Set<string> } & Omit<DayRecord, 'players' | 'visitors'>
  >();
  private readonly totals: StatsFile['totals'];
  private readonly since: string;
  private readonly now: () => number;
  private readonly dayFormat: Intl.DateTimeFormat;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(
    private readonly options: PlayStatsOptions,
    file: StatsFile | null,
  ) {
    this.now = options.now ?? Date.now;
    this.dayFormat = new Intl.DateTimeFormat('en-CA', {
      timeZone: options.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    this.since = file?.since ?? this.today();
    this.totals = file?.totals ?? { gamesStarted: 0, gamesFinished: 0, seats: 0 };
    this.players = new Set(file?.players);
    this.visitors = new Set(file?.visitors);
    for (const [date, day] of Object.entries(file?.days ?? {})) {
      this.days.set(date, {
        ...day,
        players: new Set(day.players),
        visitors: new Set(day.visitors),
      });
    }
  }

  /** Loads the file at `path` when there is one; a file that cannot be read is set aside. */
  static open(options: PlayStatsOptions): PlayStats {
    return new PlayStats(options, readStatsFile(options));
  }

  recordVisit(deviceId: string | null): void {
    if (!deviceId) return;
    const hash = hashDevice(deviceId);
    this.visitors.add(hash);
    this.day().visitors.add(hash);
    this.scheduleSave();
  }

  recordGameStarted(deviceIds: readonly string[], seats: number): void {
    const day = this.day();
    this.totals.gamesStarted += 1;
    this.totals.seats += seats;
    day.gamesStarted += 1;
    for (const deviceId of deviceIds) {
      const hash = hashDevice(deviceId);
      this.players.add(hash);
      day.players.add(hash);
    }
    this.scheduleSave();
  }

  recordGameFinished(): void {
    this.totals.gamesFinished += 1;
    this.day().gamesFinished += 1;
    this.scheduleSave();
  }

  observeOnline(count: number): void {
    const day = this.day();
    if (count <= day.peakOnline) return;
    day.peakOnline = count;
    this.scheduleSave();
  }

  summary(online: OnlineNow): StatsSummary {
    this.prune();
    return {
      since: this.since,
      timeZone: this.options.timeZone,
      online,
      totals: {
        players: this.players.size,
        visitors: this.visitors.size,
        gamesStarted: this.totals.gamesStarted,
        gamesFinished: this.totals.gamesFinished,
        seats: this.totals.seats,
      },
      days: [...this.days.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, day]) => ({
          date,
          players: day.players.size,
          visitors: day.visitors.size,
          gamesStarted: day.gamesStarted,
          gamesFinished: day.gamesFinished,
          peakOnline: day.peakOnline,
        })),
    };
  }

  /** Writes now (atomically: a temp file renamed over the old one). */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const path = this.options.path;
    if (!path) return;
    this.prune();
    const file: StatsFile = {
      version: 1,
      since: this.since,
      totals: this.totals,
      players: [...this.players],
      visitors: [...this.visitors],
      days: Object.fromEntries(
        [...this.days.entries()].map(([date, day]) => [
          date,
          { ...day, players: [...day.players], visitors: [...day.visitors] },
        ]),
      ),
    };
    mkdirSync(dirname(path), { recursive: true });
    const temp = `${path}.tmp`;
    writeFileSync(temp, JSON.stringify(file));
    renameSync(temp, path);
  }

  close(): void {
    this.flush();
  }

  private scheduleSave(): void {
    if (!this.options.path || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        this.flush();
      } catch (error) {
        this.options.log?.('stats save failed', { error: String(error) });
      }
    }, this.options.saveDelayMs ?? DEFAULT_SAVE_DELAY_MS);
    this.saveTimer.unref?.();
  }

  private today(): string {
    return this.dayFormat.format(this.now());
  }

  private day() {
    const date = this.today();
    let day = this.days.get(date);
    if (!day) {
      day = {
        players: new Set(),
        visitors: new Set(),
        gamesStarted: 0,
        gamesFinished: 0,
        peakOnline: 0,
      };
      this.days.set(date, day);
      this.prune();
    }
    return day;
  }

  /** Daily rows older than the retention window go; the all-time totals stay. */
  private prune(): void {
    const keep = this.options.retentionDays ?? DEFAULT_RETENTION_DAYS;
    const cutoff = this.dayFormat.format(this.now() - (keep - 1) * 86_400_000);
    for (const date of this.days.keys()) {
      if (date < cutoff) this.days.delete(date);
    }
  }
}

function hashDevice(deviceId: string): string {
  return createHash('sha256').update(deviceId).digest('hex').slice(0, 16);
}

function readStatsFile(options: PlayStatsOptions): StatsFile | null {
  const { path } = options;
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as StatsFile;
    if (parsed.version !== 1) throw new Error(`unknown stats version ${String(parsed.version)}`);
    return parsed;
  } catch (error) {
    // Never overwrite history we could not read: keep it for a human to look at.
    const aside = `${path}.corrupt-${Date.now()}`;
    renameSync(path, aside);
    options.log?.('stats file unreadable, set aside', { aside, error: String(error) });
    return null;
  }
}
