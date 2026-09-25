// Play one scripted four-player game per device and screenshot every stage.
//
//   npm run build -w client && PORT=8090 npx tsx server/src/index.ts   # in one shell
//   node tools/evidence.mjs --out evidence/<date> [--base http://localhost:8090] [--device iphone|android|all]
//
// Answers and votes are steered so the rare moments happen: a mic drop, a Silenced sweep,
// Great Minds (identical answers), a roast that backfires, and a tie. Every screenshot also
// records which character poses were on screen and whether each one was animating; the
// run fails if any of the five poses never appeared or was frozen.
import { chromium, devices, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const BASE = args.base ?? 'http://localhost:8090';
const OUT = args.out ?? `evidence/${new Date().toISOString().slice(0, 10)}`;
const WHICH = args.device ?? 'all';
const NAMES = ['Ann', 'Bob', 'Cat', 'Dee'];
const CHARACTERS = { Ann: 'Cat', Bob: 'Monkey', Cat: 'Frog', Dee: 'Axolotl' };
const STATES = ['idle', 'writing', 'waiting', 'win', 'lose'];

const PROFILES = {
  iphone: { label: 'iPhone 13', device: devices['iPhone 13'], engine: 'webkit' },
  android: { label: 'Pixel 7', device: devices['Pixel 7'], engine: 'chromium' },
};

const failures = [];
for (const key of WHICH === 'all' ? Object.keys(PROFILES) : [WHICH]) {
  const profile = PROFILES[key];
  if (!profile) throw new Error(`unknown --device ${key}; use iphone, android or all`);
  const report = await playOneGame(key, profile);
  for (const state of STATES) {
    if (!report.poses[state]?.seen) failures.push(`${key}: pose "${state}" never appeared`);
    else if (!report.poses[state].animated)
      failures.push(`${key}: pose "${state}" was never animating`);
  }
  failures.push(...report.errors.map((error) => `${key}: ${error}`));
}
if (failures.length > 0) {
  console.error(`\nFAILED\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`\nAll stages captured under ${OUT}`);

async function playOneGame(key, profile) {
  const dir = join(OUT, key);
  mkdirSync(dir, { recursive: true });
  const { browser, engine } = await launch(profile.engine);
  console.log(`\n== ${profile.label} (${engine}) -> ${dir}`);
  const report = { device: profile.label, engine, shots: [], poses: {}, errors: [] };
  let counter = 0;

  const players = [];
  for (const name of NAMES) {
    const context = await browser.newContext({ ...profile.device, baseURL: `${BASE}/` });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(`[${name}] page error: ${error.message}`));
    page.on('response', (response) => {
      if (response.status() >= 400)
        report.errors.push(`[${name}] ${response.status()} ${response.url()}`);
    });
    await page.goto('./');
    players.push({ name, page });
  }
  const [ann, bob, cat, dee] = players;

  async function shot(player, label, { settle = 450, fullPage = false } = {}) {
    await player.page.waitForTimeout(settle);
    counter += 1;
    const file = `${String(counter).padStart(2, '0')}-${label}-${player.name.toLowerCase()}.png`;
    await player.page.screenshot({ path: join(dir, file), fullPage });
    const poses = await player.page.evaluate(() =>
      [...document.querySelectorAll('.char-wrap[data-state]')].map((wrap) => {
        const moving = wrap.querySelector('img') ?? wrap.querySelector('.c-body') ?? wrap;
        return { state: wrap.dataset.state, animated: moving.getAnimations().length > 0 };
      }),
    );
    for (const { state, animated } of poses) {
      const entry = (report.poses[state] ??= { seen: 0, animated: false });
      entry.seen += 1;
      entry.animated ||= animated;
    }
    report.shots.push({ file, poses: [...new Set(poses.map((p) => p.state))] });
    console.log(`  ${file}`);
  }

  // Home, How to play, joining
  await shot(ann, 'home');
  await ann.page.getByRole('button', { name: 'How to play' }).click();
  await shot(ann, 'how-to-play');
  await ann.page.locator('.howto__step').last().scrollIntoViewIfNeeded();
  await shot(ann, 'how-to-play-end');
  await ann.page.getByRole('button', { name: 'Got it' }).click();
  await ann.page.getByLabel('Your name').fill('Ann');
  await ann.page.getByRole('button', { name: 'Create Room' }).click();
  const code = (await ann.page.locator('.roomcode').innerText()).trim();
  await shot(ann, 'lobby-alone');

  await bob.page.getByLabel('Your name').fill('Bob');
  await bob.page.getByRole('button', { name: 'Join Room' }).click();
  await bob.page.getByLabel('Room code').fill(code);
  await shot(bob, 'join-with-code');
  await bob.page.getByRole('button', { name: 'Join', exact: true }).click();
  for (const p of [cat, dee]) {
    await p.page.goto(`./?code=${code}`);
    await p.page.getByLabel('Your name').fill(p.name);
    await p.page.getByRole('button', { name: 'Join', exact: true }).click();
  }
  await ann.page.locator('.pchip__name').nth(3).waitFor();

  // Character race, then custom prompts
  for (const p of players) {
    await p.page.locator('.ccell', { hasText: CHARACTERS[p.name] }).click();
  }
  await waitUntil(async () => (await ann.page.locator('.ccell__owner').count()) === 4);
  await shot(ann, 'lobby-characters-picked');
  await shot(bob, 'lobby-not-leader');
  await ann.page.getByRole('radio', { name: 'Custom', exact: true }).click();
  await bob.page.getByLabel('New prompt').fill('The worst thing to find in your sock drawer.');
  await bob.page.getByRole('button', { name: 'Add', exact: true }).click();
  await ann.page.locator('.plist__text').first().waitFor();
  await ann.page.locator('.plist').scrollIntoViewIfNeeded();
  await shot(ann, 'lobby-custom-prompts');
  await ann.page.getByRole('button', { name: 'Start Game' }).click();

  // Round 1
  await ann.page.locator('.intro').waitFor();
  await shot(ann, 'r1-intro', { settle: 1200 });
  await ann.page.locator('.winput__field').waitFor({ timeout: 15_000 });
  await ann.page.locator('.winput__field').blur();
  await shot(ann, 'r1-writing');
  await ann.page.locator('.winput__field').fill('Ann has a very normal answer here');
  await shot(ann, 'r1-writing-typed');
  await ann.page.locator('.winput__field').fill('');
  await writeRound(ann, answerFor);
  await shot(ann, 'r1-waiting-room');
  for (const p of [bob, cat, dee]) await writeRound(p, answerFor);
  await playVoting('r1', (texts, matchup) => (matchup === 1 ? 'split' : 0));
  await ann.page.getByText('Scoreboard').waitFor();
  await shot(ann, 'r1-scoreboard', { settle: 900 });

  // Round 2: Ann roasts Bob; voters back Bob so the roast backfires
  await ann.page.getByText('Roast window').waitFor({ timeout: 20_000 });
  await shot(ann, 'r2-roast-window');
  await ann.page.locator('.roast__target', { hasText: 'Bob' }).click();
  await bob.page.getByText("YOU'VE BEEN ROASTED").waitFor();
  await shot(bob, 'r2-roasted');
  await bob.page.locator('.overlay--roast').click();
  await shot(ann, 'r2-roast-spent');
  await bob.page.locator('.winput__field').waitFor({ timeout: 20_000 });
  await bob.page.locator('.winput__field').blur();
  await shot(bob, 'r2-writing-roasted');
  for (const p of players) await writeRound(p, answerFor);
  await playVoting('r2', (texts) =>
    Math.max(
      0,
      texts.findIndex((t) => t.includes('Bob')),
    ),
  );
  await ann.page.getByText('Scoreboard').waitFor();
  await shot(ann, 'r2-scoreboard', { settle: 900 });

  // Final round
  await ann.page.getByText('Say Nothing').waitFor({ timeout: 20_000 });
  await shot(ann, 'final-intro', { settle: 1500 });
  await ann.page.locator('.winput__field').waitFor({ timeout: 15_000 });
  await ann.page.locator('.winput__field').blur();
  await shot(ann, 'final-writing');
  for (const p of players) {
    await p.page.locator('.winput__field').fill(`${p.name} final answer`);
    await p.page.locator('.winput button[type=submit]').click();
  }
  await ann.page.getByText('Pick your top two').waitFor();
  await shot(ann, 'final-voting');
  for (const p of players) {
    const cards = p.page.locator('button.wcard:not([disabled])');
    await cards.nth(0).click();
    await cards.nth(1).click();
    if (p === ann) await shot(ann, 'final-voting-picked');
    await p.page.getByRole('button', { name: 'Lock in' }).click();
    if (p === ann) await shot(ann, 'final-voting-locked');
  }

  // Podium, then rematch
  await ann.page.getByRole('heading', { name: 'Podium' }).waitFor();
  await shot(ann, 'podium', { settle: 1500 });
  await shot(ann, 'podium-full', { fullPage: true });
  await shot(bob, 'podium-not-leader');
  await ann.page.getByRole('button', { name: 'Rematch' }).click();
  await bob.page.locator('.roomcode').waitFor();
  await shot(bob, 'rematch-lobby');

  writeFileSync(join(dir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  return report;

  function answerFor(player, prompt, limit) {
    // Both authors of a prompt see the same text, so hashing it gives them the same
    // answer about a third of the time: Great Minds.
    const hash = [...prompt].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);
    if (hash % 3 === 0 && limit > 2) return 'Exactly the same thing';
    return limit <= 2 ? `${player.name} wins` : `${player.name} says it shorter`;
  }

  async function writeRound(player, answer) {
    for (let i = 0; i < 2; i++) {
      const field = player.page.locator('.winput__field');
      await player.page.locator('.winput__field, .waitroom').first().waitFor({ timeout: 20_000 });
      if (!(await field.isVisible())) return;
      const prompt = (await player.page.locator('.deck__card .prompt').innerText()).trim();
      const limit = Number(
        /\/\s*(\d+)/.exec(await player.page.locator('.winput__count').innerText())?.[1],
      );
      await field.fill(answer(player, prompt, limit));
      await player.page.locator('.winput button[type=submit]').click();
      await player.page.waitForTimeout(250);
    }
  }

  async function playVoting(label, choose) {
    await ann.page.getByText(/Matchup 1 of/).waitFor({ timeout: 20_000 });
    const total = Number(/of (\d+)/.exec(await ann.page.getByText(/Matchup 1 of/).innerText())[1]);
    for (let m = 0; m < total; m++) {
      await ann.page.getByText(`Matchup ${m + 1} of ${total}`).waitFor({ timeout: 20_000 });
      const voters = [];
      let author = null;
      for (const p of players) {
        if ((await p.page.locator('button.vcard:not([disabled])').count()) > 0) voters.push(p);
        else author ??= p;
      }
      if (m === 0) {
        await shot(voters[0], `${label}-voting-voter`);
        if (author) await shot(author, `${label}-voting-author`);
      }
      const texts = await voters[0].page.locator('button.vcard .answer-text').allInnerTexts();
      const pick = choose(texts, m);
      for (const [i, voter] of voters.entries()) {
        const index = pick === 'split' ? i % 2 : pick;
        await voter.page.locator('button.vcard:not([disabled])').nth(index).click();
      }
      const watcher = voters[0];
      await watcher.page.locator('.rcard').first().waitFor({ timeout: 20_000 });
      await watcher.page.waitForTimeout(1_250);
      const micDrop = await watcher.page.locator('.micdrop-overlay').isVisible();
      if (micDrop) await shot(watcher, `${label}-m${m + 1}-mic-drop`, { settle: 0 });
      await watcher.page.waitForTimeout(micDrop ? 1_700 : 1_200);
      const awards = await watcher.page
        .locator('.reveal .stamps img, .reveal .stamp-banner img')
        .evaluateAll((imgs) => [...new Set(imgs.map((img) => img.alt))].join(' '));
      const tag = [
        awards
          .toLowerCase()
          .replace(/[^a-z]+/g, '-')
          .replace(/^-|-$/g, ''),
        pick === 'split' ? 'tie' : '',
      ]
        .filter(Boolean)
        .join('-');
      await shot(watcher, `${label}-m${m + 1}-reveal${tag ? `-${tag}` : ''}`, { settle: 0 });
      if (m === total - 1) break;
      await ann.page.locator('.voting, .results').first().waitFor({ timeout: 20_000 });
    }
  }

  async function waitUntil(check, timeout = 10_000) {
    const deadline = Date.now() + timeout;
    while (!(await check())) {
      if (Date.now() > deadline) throw new Error('condition not met in time');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function launch(preferred) {
  if (preferred === 'webkit') {
    try {
      return { browser: await webkit.launch(), engine: 'webkit' };
    } catch {
      console.warn(
        'WebKit is not installed (npx playwright install webkit); using Chromium at iPhone size',
      );
    }
  }
  return { browser: await chromium.launch(), engine: 'chromium' };
}
