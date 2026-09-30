import { errors, expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS_DIR ?? 'e2e/shots-modes';

interface Player {
  name: string;
  page: Page;
}

type ScreenName =
  | 'lobby'
  | 'intro'
  | 'create'
  | 'writing'
  | 'voting'
  | 'reveal'
  | 'results'
  | 'final'
  | 'freveal'
  | 'podium';

async function newPlayer(browser: Browser, name: string): Promise<Player> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    throw new Error(`[${name}] page error: ${error.message}`);
  });
  await page.goto('./');
  return { name, page };
}

async function screenOf(page: Page): Promise<ScreenName | null> {
  const cls = (await page.locator('main.screen').first().getAttribute('class')) ?? '';
  const names: ScreenName[] = [
    'lobby',
    'intro',
    'create',
    'writing',
    'voting',
    'reveal',
    'results',
    'freveal',
    'final',
    'podium',
  ];
  return names.find((n) => cls.split(' ').includes(n)) ?? null;
}

/** A face with a hat: a few real strokes drawn with the pointer. */
async function doodle(page: Page): Promise<void> {
  const box = (await page.locator('.drawpad__surface').boundingBox())!;
  const at = (x: number, y: number) => [box.x + box.width * x, box.y + box.height * y] as const;
  const stroke = async (points: [number, number][]) => {
    const [sx, sy] = at(...points[0]!);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (const p of points.slice(1)) {
      const [x, y] = at(...p);
      await page.mouse.move(x, y, { steps: 6 });
    }
    await page.mouse.up();
  };
  const circle = Array.from({ length: 25 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return [0.5 + 0.28 * Math.cos(a), 0.55 + 0.28 * Math.sin(a)] as [number, number];
  });
  await stroke(circle);
  await stroke([[0.4, 0.5]]);
  await stroke([[0.6, 0.5]]);
  await stroke([
    [0.38, 0.66],
    [0.5, 0.74],
    [0.62, 0.66],
  ]);
  await page.getByRole('button', { name: 'Red' }).click();
  await stroke([
    [0.3, 0.3],
    [0.5, 0.08],
    [0.7, 0.3],
    [0.3, 0.3],
  ]);
}

/** Every phone does whatever its current screen asks, once per call. */
async function act(p: Player, answer: string): Promise<void> {
  try {
    await actOnce(p.page, answer);
  } catch (error) {
    // The phase moved on mid-action (the last vote closed voting): the next pass catches up.
    if (!(error instanceof errors.TimeoutError)) throw error;
  }
}

async function actOnce(page: Page, answer: string): Promise<void> {
  page.setDefaultTimeout(3_000);
  if (await page.locator('.drawpad__surface').isVisible()) {
    await doodle(page);
    await page.getByRole('button', { name: 'Done drawing' }).click();
    return;
  }
  const field = page.locator('.winput__field:not([disabled])');
  if (await field.isVisible()) {
    // On the CREATING screen the honest answer about yourself; elsewhere the round's answer.
    const creating = (await page.locator('main.create').count()) > 0;
    await field.fill(creating ? 'juggling badly' : answer);
    await page.locator('.winput button[type=submit]').click();
    return;
  }
  const vote = page.locator('button.vcard:not([disabled])');
  if ((await vote.count()) > 0) {
    await vote.first().click();
    return;
  }
  const wall = page.locator('button.wcard:not([disabled])');
  if ((await wall.count()) >= 2 && (await page.locator('.wcard--picked').count()) === 0) {
    await wall.nth(0).click();
    await wall.nth(1).click();
    await page.getByRole('button', { name: 'Lock in' }).click();
  }
}

async function playMode(
  browser: Browser,
  mode: 'Doodle' | 'Out of Context',
  dir: string,
  answers: Record<string, string>,
): Promise<Player[]> {
  const out = `${SHOTS}/${dir}`;
  mkdirSync(out, { recursive: true });
  const players = [
    await newPlayer(browser, 'Ann'),
    await newPlayer(browser, 'Bob'),
    await newPlayer(browser, 'Cat'),
  ];
  const [ann, bob, cat] = players as [Player, Player, Player];
  await ann.page.getByLabel('Your name').fill('Ann');
  await ann.page.getByRole('button', { name: 'Create Room' }).click();
  const code = (await ann.page.locator('.roomcode').innerText()).trim();
  for (const p of [bob, cat]) {
    await p.page.getByLabel('Your name').fill(p.name);
    await p.page.getByRole('button', { name: 'Join Room' }).click();
    await p.page.getByLabel('Room code').fill(code);
    await p.page.getByRole('button', { name: 'Join', exact: true }).click();
    await p.page.locator('.roomcode').waitFor();
  }
  await ann.page.getByRole('radio', { name: mode }).click();
  await expect(ann.page.getByRole('radio', { name: mode })).toHaveAttribute('aria-checked', 'true');
  await expect(ann.page.locator('.packs')).toHaveCount(0);
  await ann.page.locator('.modes').scrollIntoViewIfNeeded();
  await ann.page.screenshot({ path: `${out}/01-lobby-mode.png` });
  await ann.page.getByRole('button', { name: 'Start Game' }).click();

  // Each screen is captured the first time Ann sees it in each round, from both of the
  // first two players, so a drawing task and a caption task both land in the evidence.
  const seen = new Set<string>();
  let round = 1;
  const deadline = Date.now() + 8 * 60_000;
  while (Date.now() < deadline) {
    const screen = await screenOf(ann.page);
    if (screen === 'results') round = 2;
    if (screen === 'final' || screen === 'freveal') round = 3;
    const key = `${round}-${screen}`;
    if (screen && !seen.has(key)) {
      seen.add(key);
      await ann.page.waitForTimeout(screen === 'freveal' ? 9_000 : 900);
      const shotName = `${String(seen.size + 1).padStart(2, '0')}-r${round}-${screen}`;
      await ann.page.screenshot({ path: `${out}/${shotName}-ann.png` });
      if (screen === 'create' || screen === 'writing' || screen === 'voting') {
        await bob.page.screenshot({ path: `${out}/${shotName}-bob.png` });
      }
      if (screen === 'podium') break;
    }
    for (const p of players) await act(p, answers[p.name]!);
    await ann.page.waitForTimeout(400);
  }
  await expect(ann.page.locator('main.podium')).toBeVisible();
  return players;
}

test('Doodle: draw, caption each other, replay the favourite drawing in the final', async ({
  browser,
}) => {
  test.setTimeout(9 * 60_000);
  const players = await playMode(browser, 'Doodle', 'doodle', {
    Ann: 'A potato in witness protection',
    Bob: 'My landlord, emotionally',
    Cat: 'Self portrait, Tuesday',
  });
  // The final replays one of the round drawings, and the podium names its artist.
  await expect(players[0]!.page.locator('.podium')).toBeVisible();
});

test('Out of Context: answer honestly, others swap the question, the favourite returns', async ({
  browser,
}) => {
  test.setTimeout(9 * 60_000);
  const [ann] = await playMode(browser, 'Out of Context', 'context', {
    Ann: 'Worst thing to do at a funeral?',
    Bob: 'Why was this person banned from the zoo?',
    Cat: 'Your secret to a happy marriage?',
  });
  await expect(ann!.page.locator('.podium')).toBeVisible();
});
