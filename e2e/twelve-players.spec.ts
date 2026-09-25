import { expect, test, type Locator, type Page } from '@playwright/test';
import { answerAllPrompts, Evidence, type Phone } from './helpers.ts';

const NAMES = [
  'Ann',
  'Bartholomew',
  'Cat',
  'Dominique',
  'Eve',
  'Jacqueline M',
  'Gus',
  'Henrietta',
  'Ivy',
  'Jo',
  'Kassandra',
  'Maximiliano',
];
const OPENERS = [
  'Grandma',
  'Seven',
  'Soggy',
  'Tax',
  'Haunted',
  'Tiny',
  'Angry',
  'Free',
  'Wet',
  'Loud',
  'Cursed',
  'Spicy',
];
const TAILS = [
  'socks',
  'pigeons',
  'lasagna',
  'receipts',
  'karaoke',
  'goats',
  'yogurt',
  'crocs',
  'sirens',
  'mayonnaise',
  'trombones',
  'bagels',
];
const FILLER = 'delivered by pigeons who refuse to take tips ever again'.split(' ');
const MATCHUPS = NAMES.length;

interface RevealRow {
  name: string;
  delta: number;
}

/** Two words for most players; every fourth player uses the whole budget to stress the cards. */
function answerFor(player: number, round: number, card: number, limit: number): string {
  const words = [OPENERS[player]!, TAILS[(player * 2 + card + round * 5) % TAILS.length]!];
  const wanted = player % 4 === 2 ? limit : Math.min(2, limit);
  return [...words, ...FILLER].slice(0, wanted).join(' ');
}

function cleanName(text: string): string {
  return text.replace(/\s*\(you\)$/, '').trim();
}

/** Vote split for the n-th voter in matchup m: sweep, tie, 7-3 and 4-6 in turn. */
function choiceFor(m: number, voter: number): 0 | 1 {
  switch (m % 4) {
    case 0:
      return 0;
    case 1:
      return (voter % 2) as 0 | 1;
    case 2:
      return voter < 7 ? 1 : 0;
    default:
      return voter < 4 ? 0 : 1;
  }
}

async function readRoundBoard(page: Page): Promise<Map<string, { delta: number; score: number }>> {
  const rows = page.locator('.results .board__row');
  await expect(rows).toHaveCount(NAMES.length);
  const board = new Map<string, { delta: number; score: number }>();
  for (const row of await rows.all()) {
    const name = cleanName(await row.locator('.board__name').innerText());
    const deltaText = (await row.locator('.board__delta').innerText()).replace(/\s/g, '');
    const delta = deltaText === '–' ? 0 : Number(deltaText.replace('▲', '').replace('▼', '-'));
    const score = Number(await row.locator('.board__score').innerText());
    board.set(name, { delta, score });
  }
  return board;
}

test('twelve phones play a full game and reach the podium', async ({ browser }, testInfo) => {
  test.setTimeout(10 * 60_000);
  const evidence = new Evidence(process.env.SHOTS_DIR ?? 'e2e/shots-twelve');
  const players: Phone[] = [];
  for (const name of NAMES) players.push(await evidence.openPhone(browser, name));
  const [leader, guest] = [players[0]!, players[1]!];
  const both = async (name: string, options?: { fullPage?: boolean }) => {
    await Promise.all([
      evidence.shot(leader.page, `${name}-leader`, options),
      evidence.shot(guest.page, `${name}-player`, options),
    ]);
  };
  const everyone = async (see: (page: Page) => Locator) => {
    await Promise.all(players.map((p) => expect(see(p.page)).toBeVisible()));
  };
  const laps: [string, number][] = [];
  let lapStart = Date.now();
  const lap = (label: string) => {
    laps.push([label, Date.now() - lapStart]);
    lapStart = Date.now();
  };

  // --- Create, eleven join, a thirteenth is turned away
  await leader.page.getByLabel('Your name').fill(leader.name);
  await leader.page.getByRole('button', { name: 'Create Room' }).click();
  const code = (await leader.page.locator('.roomcode').innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
  const join = async (p: Phone) => {
    await p.page.getByLabel('Your name').fill(p.name);
    await p.page.getByRole('button', { name: 'Join Room' }).click();
    await p.page.getByLabel('Room code').fill(code);
    await p.page.getByRole('button', { name: 'Join', exact: true }).click();
  };
  await Promise.all(
    players.slice(1).map(async (p) => {
      await join(p);
      await p.page.locator('.roomcode').waitFor();
    }),
  );
  await expect(leader.page.locator('.pchip__name')).toHaveCount(12);
  await expect(leader.page.getByText('12 / 12')).toBeVisible();
  const extra = await evidence.openPhone(browser, 'Zed');
  await join(extra);
  await expect(extra.page.getByRole('alert')).toHaveText('Room is full');
  await expect(extra.page.locator('.roomcode')).toHaveCount(0);
  await extra.page.context().close();
  lap('create + 11 joins');

  // --- Every player takes a different character
  for (const [i, p] of players.entries()) {
    await p.page.locator('.ccell').nth(i).click();
    await expect(p.page.locator('.ccell--mine')).toHaveCount(1);
  }
  await expect(leader.page.locator('.ccell--taken')).toHaveCount(11);
  await expect(guest.page.locator('.ccell--taken')).toHaveCount(11);
  await both('01-lobby-12');
  await both('01-lobby-12-full', { fullPage: true });
  await guest.page.locator('.cgrid').scrollIntoViewIfNeeded();
  await evidence.shot(guest.page, '01-lobby-12-characters-player');
  await leader.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await evidence.shot(leader.page, '01-lobby-12-bottom-leader');
  lap('character picks');
  await leader.page.getByRole('button', { name: 'Start Game' }).click();

  // --- Round 1: dealt immediately, everyone writes
  await everyone((page) => page.getByText('Say Some'));
  await both('02-r1-intro');
  await everyone((page) => page.locator('.winput__field'));
  lap('r1 intro (4 s timer)');
  await both('03-r1-writing');
  await answerAllPrompts(leader, (card, limit) => answerFor(0, 1, card, limit));
  await evidence.shot(leader.page, '04-r1-waiting-leader');
  await Promise.all(
    players.slice(1, 7).map((p) => {
      const i = players.indexOf(p);
      return answerAllPrompts(p, (card, limit) => answerFor(i, 1, card, limit));
    }),
  );
  await evidence.shot(guest.page, '04-r1-waiting-player');
  await Promise.all(
    players.slice(7).map((p) => {
      const i = players.indexOf(p);
      return answerAllPrompts(p, (card, limit) => answerFor(i, 1, card, limit));
    }),
  );
  lap('r1 writing (short-circuited)');

  const scores = new Map<string, number>(NAMES.map((n) => [n, 0]));
  await playVotingRound(1);

  // --- Round 2: roast window cannot be skipped
  await everyone((page) => page.getByText('Say Less', { exact: true }));
  lap('r2 intro (4 s timer)');
  await everyone((page) => page.getByText('Roast window'));
  const roastOpened = Date.now();
  await both('08-r2-roast-window');
  await both('08-r2-roast-window-full', { fullPage: true });
  await leader.page.locator('.roast__target', { hasText: guest.name }).click();
  await players[5]!.page.locator('.roast__target', { hasText: players[8]!.name }).click();
  await guest.page.getByText("YOU'VE BEEN ROASTED").waitFor();
  await evidence.shot(guest.page, '09-r2-roasted-player');
  await evidence.shot(leader.page, '09-r2-roast-spent-leader');
  await guest.page.locator('.overlay--roast').click();
  await everyone((page) => page.locator('.winput__field'));
  lap(`r2 roast window (fixed, measured ${Date.now() - roastOpened} ms from first sight)`);
  await expect(guest.page.locator('.winput__count')).toHaveText(/\/ 2 words/);
  await expect(players[8]!.page.locator('.winput__count')).toHaveText(/\/ 2 words/);
  await both('10-r2-writing');
  await Promise.all(
    players.map((p, i) => answerAllPrompts(p, (card, limit) => answerFor(i, 2, card, limit))),
  );
  lap('r2 writing (short-circuited)');
  await playVotingRound(2);

  // --- Final: everyone answers, everyone ranks two
  await everyone((page) => page.getByText('Say Nothing'));
  await both('14-final-intro');
  await everyone((page) => page.locator('.winput__field'));
  lap('final intro (4 s timer)');
  await expect(leader.page.locator('.winput__count')).toHaveText(/\/ 3 words/);
  await Promise.all(
    players.map(async (p, i) => {
      await p.page.locator('.winput__field').fill(`${OPENERS[i]} ${TAILS[i]} forever`);
      await p.page.locator('.winput button[type=submit]').click();
    }),
  );
  await everyone((page) => page.getByText('Pick your top two'));
  lap('final writing (short-circuited)');
  await Promise.all(players.map((p) => expect(p.page.locator('button.wcard')).toHaveCount(12)));
  await both('15-final-wall');
  await both('15-final-wall-full', { fullPage: true });
  const pickTwo = async (p: Phone, i: number) => {
    const cards = p.page.locator('button.wcard:not([disabled])');
    await expect(cards).toHaveCount(11);
    await cards.nth(i % 11).click();
    await cards.nth((i + 3) % 11).click();
  };
  await pickTwo(guest, 1);
  await evidence.shot(guest.page, '16-final-picked-player');
  await Promise.all(
    players.map(async (p, i) => {
      if (p !== guest) await pickTwo(p, i);
      if (p !== leader) await p.page.getByRole('button', { name: 'Lock in' }).click();
    }),
  );
  await evidence.shot(leader.page, '16-final-picked-leader');
  await leader.page.getByRole('button', { name: 'Lock in' }).click();

  // --- Podium: twelve rows, totals add up
  await everyone((page) => page.getByRole('heading', { name: 'Podium' }));
  lap('final voting (short-circuited)');
  await leader.page.waitForTimeout(1_000);
  await both('17-podium');
  await both('17-podium-full', { fullPage: true });
  const podiumRows = leader.page.locator('.podium .board__row');
  await expect(podiumRows).toHaveCount(12);
  const finals = leader.page.locator('.fanswer');
  await expect(finals).toHaveCount(12);
  const finalPoints = new Map<string, number>();
  for (const row of await finals.all()) {
    const who = (await row.locator('.dim.small').innerText()).split(' · ')[0]!.trim();
    finalPoints.set(who, Number(await row.locator('.fanswer__pts').innerText()));
  }
  // 12 voters × (200 + 100) × 2
  expect([...finalPoints.values()].reduce((a, b) => a + b, 0)).toBe(7_200);
  const podiumNames: string[] = [];
  for (const row of await podiumRows.all()) {
    const name = cleanName(await row.locator('.board__name').innerText());
    podiumNames.push(name);
    const score = Number(await row.locator('.board__score').innerText());
    expect(score, `${name} podium total`).toBe(scores.get(name)! + finalPoints.get(name)!);
  }
  expect(podiumNames.sort()).toEqual([...NAMES].sort());
  await expect(leader.page.getByRole('button', { name: 'Rematch' })).toBeVisible();
  await expect(guest.page.getByText('Waiting for the leader')).toBeVisible();

  evidence.save(testInfo);
  const timing = laps.map(([label, ms]) => `${label}: ${(ms / 1000).toFixed(1)} s`).join('\n');
  testInfo.annotations.push({ type: 'timing', description: timing });
  console.log(`Phase timings\n${timing}`);

  async function playVotingRound(round: number): Promise<void> {
    const deltas = new Map<string, number>(NAMES.map((n) => [n, 0]));
    let authorShot = false;
    for (let m = 0; m < MATCHUPS; m++) {
      const label = `Matchup ${m + 1} of ${MATCHUPS}`;
      const roles = await Promise.all(
        players.map(async (p) => {
          await expect(p.page.getByText(label)).toBeVisible();
          return (await p.page.locator('button.vcard:not([disabled])').count()) > 0;
        }),
      );
      const voters = players.filter((_, i) => roles[i]);
      expect(voters, `${label} voters`).toHaveLength(NAMES.length - 2);
      if (m === 0) await both(`05-r${round}-voting`);
      if (!authorShot && !voters.includes(guest)) {
        await evidence.shot(guest.page, `05-r${round}-voting-author-player`);
        authorShot = true;
      }
      await Promise.all(
        voters.map((p, v) => p.page.locator('button.vcard').nth(choiceFor(m, v)).click()),
      );
      await everyone((page) => page.locator('.reveal .rcard').first());
      const revealed: RevealRow[] = [];
      for (const card of await leader.page.locator('.rcard').all()) {
        revealed.push({
          name: cleanName(await card.locator('.rcard__name').innerText()),
          delta: Number(await card.locator('.rcard__points').innerText()),
        });
      }
      for (const row of revealed) deltas.set(row.name, deltas.get(row.name)! + row.delta);
      if (m === 0) {
        const faces = leader.page.locator('.rcard').first().locator('.voters .char-wrap');
        await expect(faces).toHaveCount(NAMES.length - 2);
        await leader.page.waitForTimeout(1_500);
        await both(`06-r${round}-reveal-sweep`);
        await leader.page.waitForTimeout(1_000); // the mic drop overlay fades out at 3 s
        await both(`06-r${round}-reveal-sweep-settled`);
      }
      if (m === 1) await both(`06-r${round}-reveal-tie`);
      await expect(leader.page.getByText(label)).toHaveCount(0, { timeout: 15_000 });
    }
    lap(`r${round} voting: ${MATCHUPS} matchups, reveal is a fixed timer`);

    await everyone((page) => page.getByText('Scoreboard'));
    await leader.page.waitForTimeout(1_500);
    await both(`07-r${round}-scoreboard`);
    await both(`07-r${round}-scoreboard-full`, { fullPage: true });
    const board = await readRoundBoard(leader.page);
    expect([...board.keys()].sort()).toEqual([...NAMES].sort());
    for (const [name, row] of board) {
      expect(row.delta, `${name} round ${round} delta`).toBe(deltas.get(name));
      expect(row.score, `${name} score after round ${round}`).toBe(
        scores.get(name)! + deltas.get(name)!,
      );
      scores.set(name, row.score);
    }
    lap(`r${round} scoreboard`);
  }
});
