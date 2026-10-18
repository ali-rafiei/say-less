import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptDeck } from '../src/prompts.ts';
import { Room, type GameEvent } from '../src/room.ts';
import { PlayStats } from '../src/stats.ts';
import { statsHandler } from '../src/statsRoute.ts';
import { advanceToPhaseEnd, fixturePrompts, seededRandom } from './helpers.ts';

const TZ = 'America/Edmonton';
const NO_ONE_ONLINE = { players: 0, audience: 0, rooms: 0 };

function tempStatsPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'say-less-stats-')), 'stats.json');
}

describe('PlayStats', () => {
  it('counts a device once as a player however many games it plays, apart from visitors', () => {
    // Arrange
    const stats = PlayStats.open({ path: null, timeZone: TZ });
    // Act: two games with the same two devices; a third device only watched
    for (const device of ['dev-aaaa-1', 'dev-bbbb-2', 'dev-cccc-3']) stats.recordVisit(device);
    stats.recordGameStarted(['dev-aaaa-1', 'dev-bbbb-2'], 3);
    stats.recordGameStarted(['dev-aaaa-1', 'dev-bbbb-2'], 3);
    stats.recordGameFinished();
    // Assert: seats count per game, players and visitors per device
    expect(stats.summary(NO_ONE_ONLINE).totals).toEqual({
      players: 2,
      visitors: 3,
      gamesStarted: 2,
      gamesFinished: 1,
      seats: 6,
    });
  });

  it('files events under the local day of the configured time zone', () => {
    // Arrange: 03:00 UTC on the 19th is still the evening of the 18th in Edmonton
    const now = Date.parse('2026-10-19T03:00:00Z');
    const stats = PlayStats.open({ path: null, timeZone: TZ, now: () => now });
    // Act
    stats.recordGameStarted(['dev-aaaa-1'], 3);
    stats.observeOnline(7);
    // Assert
    const [day] = stats.summary(NO_ONE_ONLINE).days;
    expect(day).toMatchObject({ date: '2026-10-18', gamesStarted: 1, players: 1, peakOnline: 7 });
  });

  it('keeps every count across a restart', () => {
    // Arrange
    const path = tempStatsPath();
    const first = PlayStats.open({ path, timeZone: TZ });
    first.recordVisit('dev-aaaa-1');
    first.recordGameStarted(['dev-aaaa-1'], 4);
    first.recordGameFinished();
    first.observeOnline(5);
    // Act
    first.close();
    const second = PlayStats.open({ path, timeZone: TZ });
    // Assert
    expect(second.summary(NO_ONE_ONLINE)).toEqual(first.summary(NO_ONE_ONLINE));
    second.recordGameStarted(['dev-aaaa-1'], 4);
    expect(second.summary(NO_ONE_ONLINE).totals.players).toBe(1);
  });

  it('drops daily rows older than the retention window but keeps the all-time totals', () => {
    // Arrange: a game 100 days ago, then one today
    let now = Date.parse('2026-07-10T18:00:00Z');
    const stats = PlayStats.open({ path: null, timeZone: TZ, retentionDays: 90, now: () => now });
    stats.recordGameStarted(['dev-aaaa-1'], 3);
    now = Date.parse('2026-10-18T18:00:00Z');
    // Act
    stats.recordGameStarted(['dev-bbbb-2'], 3);
    // Assert
    const summary = stats.summary(NO_ONE_ONLINE);
    expect(summary.days.map((d) => d.date)).toEqual(['2026-10-18']);
    expect(summary.totals.gamesStarted).toBe(2);
  });

  it('sets a corrupt file aside instead of overwriting it', () => {
    // Arrange
    const path = tempStatsPath();
    writeFileSync(path, '{ not json');
    const log = vi.fn();
    // Act
    const stats = PlayStats.open({ path, timeZone: TZ, log });
    stats.recordGameStarted(['dev-aaaa-1'], 3);
    stats.close();
    // Assert: the broken file survives under another name, and the new one is valid
    const dir = join(path, '..');
    expect(readdirSync(dir).some((f) => f.startsWith('stats.json.corrupt-'))).toBe(true);
    expect(existsSync(path)).toBe(true);
    expect(PlayStats.open({ path, timeZone: TZ }).summary(NO_ONE_ONLINE).totals.gamesStarted).toBe(
      1,
    );
    expect(log).toHaveBeenCalledWith('stats file unreadable, set aside', expect.anything());
  });
});

describe('room game events', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports a start with the human devices and a finish at the podium, never counting bots', () => {
    // Arrange: two phones and a bot
    const events: GameEvent[] = [];
    const room = new Room('TEST', {
      deck: new PromptDeck(fixturePrompts(), seededRandom(1)),
      send: () => {},
      random: seededRandom(2),
      onGameEvent: (event) => events.push(event),
    });
    room.addPlayer('a', 'Ann', false, 'dev-aaaa-1');
    room.addPlayer('b', 'Bob', false, 'dev-bbbb-2');
    room.addPlayer('bot', 'Beep', true);
    room.updateSettings('a', { length: 'short' });
    // Act: play to the podium on the clock alone
    room.startGame('a');
    while (room.phase !== 'PODIUM') advanceToPhaseEnd({ room } as never);
    // Assert
    expect(events).toEqual([
      { type: 'started', deviceIds: ['dev-aaaa-1', 'dev-bbbb-2'], seats: 2 },
      { type: 'finished' },
    ]);
  });
});

describe('stats page', () => {
  function call(key: string | null, query: Record<string, unknown>) {
    const stats = PlayStats.open({ path: null, timeZone: TZ });
    const res = {
      statusCode: 200,
      body: '' as unknown,
      headers: {} as Record<string, string>,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      set(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      type() {
        return this;
      },
      send(body: unknown) {
        this.body = body;
        return this;
      },
      json(body: unknown) {
        this.body = body;
        return this;
      },
      end() {
        return this;
      },
    };
    statsHandler({ stats, online: () => NO_ONE_ONLINE, key, format: 'html' })(
      { query } as never,
      res as never,
      () => {},
    );
    return res;
  }

  it('answers 404 without the right key, and when no key is configured', () => {
    expect(call('s3cret-key-123', {}).statusCode).toBe(404);
    expect(call('s3cret-key-123', { key: 'wrong' }).statusCode).toBe(404);
    expect(call(null, { key: 'anything' }).statusCode).toBe(404);
  });

  it('serves the page, uncached and unindexed, with the right key', () => {
    const res = call('s3cret-key-123', { key: 's3cret-key-123' });
    expect(res.statusCode).toBe(200);
    expect(String(res.body)).toContain('Online now');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['X-Robots-Tag']).toBe('noindex');
  });
});
