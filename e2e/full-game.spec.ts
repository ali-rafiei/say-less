import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS_DIR ?? 'e2e/shots';
mkdirSync(SHOTS, { recursive: true });

interface Player {
  name: string;
  page: Page;
}

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(500); // let the screen's entry animation finish
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function newPlayer(browser: Browser, name: string): Promise<Player> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    throw new Error(`[${name}] page error: ${error.message}`);
  });
  await page.goto('./'); // relative so a base path like /say-less/ on GitHub Pages works
  return { name, page };
}

/** Answers every prompt card in turn and returns the prompt texts that were shown. */
async function answerAllPrompts(
  player: Player,
  text: (limit: number) => string,
): Promise<string[]> {
  const seen: string[] = [];
  // Each player has up to 2 prompts; the deck shows one card at a time.
  for (let i = 0; i < 2; i++) {
    const field = player.page.locator('.winput__field');
    if (!(await field.isVisible().catch(() => false))) {
      await player.page
        .locator('.winput__field, .writing .card:has-text("Waiting on")')
        .first()
        .waitFor({ timeout: 15_000 });
      if (!(await field.isVisible().catch(() => false))) return seen;
    }
    seen.push((await player.page.locator('.deck__card .prompt').innerText()).trim());
    const counter = await player.page.locator('.winput__count').innerText();
    const limit = Number(/\/\s*(\d+)/.exec(counter)?.[1] ?? '12');
    await field.fill(text(limit));
    await player.page.locator('.winput button[type=submit]').click();
    await player.page.waitForTimeout(150);
  }
  return seen;
}

async function voteThroughRound(players: Player[], label: string, matchups: number): Promise<void> {
  for (let m = 0; m < matchups; m++) {
    await players[0]!.page.getByText(`Matchup ${m + 1} of ${matchups}`).waitFor();
    if (m === 0) await shot(players[0]!.page, `${label}-voting`);
    // The one player whose cards are enabled is the voter.
    for (const p of players) {
      const enabled = p.page.locator('button.vcard:not([disabled])');
      if ((await enabled.count()) > 0) {
        await enabled.first().click();
      }
    }
    await players[0]!.page.locator('.rcard').first().waitFor();
    await players[0]!.page.waitForTimeout(2_000);
    if (m === 0) await shot(players[0]!.page, `${label}-reveal`);
    await players[0]!.page.locator('.results, .voting').first().waitFor({ timeout: 10_000 });
  }
}

test('three phones play a full game, survive a refresh, and reach the podium', async ({
  browser,
}) => {
  const ann = await newPlayer(browser, 'Ann');
  const bob = await newPlayer(browser, 'Bob');
  const cat = await newPlayer(browser, 'Cat');
  const players = [ann, bob, cat];

  // --- Home & lobby
  await shot(ann.page, '01-home');
  await ann.page.getByRole('button', { name: 'How to play' }).click();
  await ann.page.getByRole('dialog', { name: 'How to play' }).waitFor();
  await shot(ann.page, '01b-how-to-play');
  await ann.page.getByRole('button', { name: 'Got it' }).click();
  await ann.page.getByLabel('Your name').fill('Ann');
  await ann.page.getByRole('button', { name: 'Create Room' }).click();
  const code = (await ann.page.locator('.roomcode').innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);

  for (const p of [bob, cat]) {
    await p.page.getByLabel('Your name').fill(p.name);
    await p.page.getByRole('button', { name: 'Join Room' }).click();
    await p.page.getByLabel('Room code').fill(code);
    await p.page.getByRole('button', { name: 'Join', exact: true }).click();
    await p.page.locator('.roomcode').waitFor();
  }
  await expect(ann.page.locator('.pchip__name')).toHaveCount(3);
  await expect(ann.page.getByRole('button', { name: 'Emoji final round' })).toHaveText('Off');

  // Custom prompt mode: Bob adds a prompt; it must be dealt to someone other than Bob.
  await ann.page.getByRole('radio', { name: 'Custom prompts' }).click();
  await bob.page.getByLabel('New prompt').fill('Bob custom prompt about pigeons');
  await bob.page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(ann.page.locator('.plist__text')).toHaveText(['Bob custom prompt about pigeons']);

  // --- Character select happens in the lobby (two players race for the same character)
  await ann.page.getByText('Pick your character').waitFor();
  await shot(ann.page, '02-lobby');
  // Playwright waits for enabled buttons; the loser's button gets disabled mid-race, so force both.
  await Promise.all([
    ann.page
      .locator('.ccell', { hasText: 'Smug Lemon' })
      .click({ force: true, noWaitAfter: true, timeout: 5_000 })
      .catch(() => {}),
    bob.page
      .locator('.ccell', { hasText: 'Smug Lemon' })
      .click({ force: true, noWaitAfter: true, timeout: 5_000 })
      .catch(() => {}),
  ]);
  await ann.page.waitForTimeout(500);
  const lemonOwners = await Promise.all(
    players.map((p) => p.page.locator('.ccell--mine', { hasText: 'Smug Lemon' }).count()),
  );
  expect(lemonOwners.reduce((a, b) => a + b, 0)).toBe(1);
  const loser = lemonOwners[0] === 1 ? bob : ann;
  await loser.page.locator('.ccell:not([disabled])', { hasText: 'Raccoon' }).click();
  await cat.page.locator('.ccell:not([disabled])', { hasText: 'Ice Cream' }).click();
  await expect(cat.page.locator('.ccell--mine')).toHaveCount(1);
  await shot(ann.page, '03-lobby-characters');
  await ann.page.getByRole('button', { name: 'Start Game' }).click();

  // --- Round 1
  await ann.page.getByText('Say Some').waitFor();
  await shot(ann.page, '04-round-intro');
  await ann.page.locator('.winput__field').waitFor({ timeout: 15_000 });
  await shot(ann.page, '05-writing');

  // Bob refreshes mid-write and must land back on his prompt.
  await bob.page.reload();
  await bob.page.locator('.winput__field').waitFor({ timeout: 15_000 });

  await answerAllPrompts(ann, () => 'Yes');
  await shot(ann.page, '06-waiting');
  await answerAllPrompts(bob, (limit) =>
    Array.from({ length: limit }, (_, i) => `bob${i}`).join(' '),
  );
  await answerAllPrompts(cat, (limit) =>
    Array.from({ length: limit }, (_, i) => `cat${i}`).join(' '),
  );
  await voteThroughRound(players, 'r1', 3);

  await ann.page.getByText('Scoreboard').waitFor();
  await shot(ann.page, '07-round-results');

  // --- Round 2 with a roast
  await ann.page.getByText('Say Less', { exact: true }).waitFor({ timeout: 15_000 });
  await ann.page.getByText('Roast window').waitFor({ timeout: 10_000 });
  await shot(ann.page, '08-roast-window');
  await ann.page.locator('.roast__target', { hasText: 'Bob' }).click();
  await bob.page.getByText("YOU'VE BEEN ROASTED").waitFor();
  await shot(bob.page, '09-roasted');
  await bob.page.locator('.overlay--roast').click();
  await bob.page.locator('.winput__field').waitFor({ timeout: 20_000 });
  const bobLimits: string[] = [];
  bobLimits.push(await bob.page.locator('.winput__count').innerText());
  expect(bobLimits[0]).toMatch(/\/ 2 words/);

  await answerAllPrompts(ann, () => 'Yes');
  await answerAllPrompts(bob, (limit) =>
    Array.from({ length: limit }, (_, i) => `bob${i}`).join(' '),
  );
  await answerAllPrompts(cat, (limit) =>
    Array.from({ length: limit }, (_, i) => `cat${i}`).join(' '),
  );
  await voteThroughRound(players, 'r2', 3);
  await ann.page.getByText('Scoreboard').waitFor();

  // --- Final
  await ann.page.getByText('Say Nothing').waitFor({ timeout: 15_000 });
  await shot(ann.page, '10-final-intro');
  await ann.page.locator('.winput__field').waitFor({ timeout: 15_000 });
  expect(await ann.page.locator('.winput__count').innerText()).toMatch(/\/ 3 words/);
  for (const p of players) {
    await p.page.locator('.winput__field').fill(`${p.name} says hi`);
    await p.page.locator('.winput button[type=submit]').click();
  }
  await ann.page.getByText('Pick your top two').waitFor();
  await shot(ann.page, '11-final-voting');
  for (const p of players) {
    const cards = p.page.locator('button.wcard:not([disabled])');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await p.page.getByRole('button', { name: 'Lock in' }).click();
  }

  // --- Podium
  await ann.page.getByRole('heading', { name: 'Podium' }).waitFor();
  await ann.page.waitForTimeout(1_000);
  await shot(ann.page, '12-podium');
  await expect(ann.page.getByRole('button', { name: 'Rematch' })).toBeVisible();
  await expect(bob.page.getByText('Waiting for the leader')).toBeVisible();
  const scores = await ann.page.locator('.board__score').allInnerTexts();
  expect(scores.length).toBe(3);
  // Ann answered with 1 word every time: she must have mic drops on the ticker.
  await expect(ann.page.locator('.ticker__item').first()).toContainText('Most Mic Drops');

  // --- Rematch returns everyone to the lobby with the same code
  await ann.page.getByRole('button', { name: 'Rematch' }).click();
  await expect(bob.page.locator('.roomcode')).toHaveText(code);
});
