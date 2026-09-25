import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';

interface Phone {
  name: string;
  context: BrowserContext;
  page: Page;
  /** Error codes the server sent this phone; a double-tap must never add one. */
  serverErrors: string[];
  pageErrors: string[];
  /** Only for relayed phones: `dead` makes the socket half-open (open, but silent). */
  link: { dead: boolean; welcomes: number };
}

interface PhoneOptions {
  clockSkewMs?: number;
  url?: string;
  /** Relay the socket through the test, delaying server messages by this much. */
  relayLatencyMs?: number;
}

async function openPhone(browser: Browser, name: string, options: PhoneOptions = {}) {
  const context = await browser.newContext();
  if (options.clockSkewMs) {
    await context.addInitScript((skew) => {
      const realNow = Date.now.bind(Date);
      Date.now = () => realNow() + skew;
    }, options.clockSkewMs);
  }
  const link = { dead: false, welcomes: 0 };
  const latency = options.relayLatencyMs;
  if (latency !== undefined) {
    await context.routeWebSocket(/\/ws$/, (ws) => relay(ws, link, latency));
  }
  const page = await context.newPage();
  const phone: Phone = { name, context, page, serverErrors: [], pageErrors: [], link };
  watch(phone, page);
  await page.goto(options.url ?? './');
  return phone;
}

function relay(ws: WebSocketRoute, link: Phone['link'], latencyMs: number): void {
  if (link.dead) return;
  const later = (deliver: () => void) => setTimeout(deliver, latencyMs);
  const server = ws.connectToServer();
  ws.onMessage((message) => {
    if (!link.dead) server.send(message);
  });
  server.onMessage((message) => {
    if (link.dead) return;
    if (String(message).includes('"type":"welcome"')) link.welcomes += 1;
    later(() => ws.send(message));
  });
  // A dead network carries no close frames either.
  ws.onClose((code, reason) => {
    if (!link.dead) server.close({ code, reason });
  });
  server.onClose((code, reason) => {
    if (!link.dead) later(() => ws.close({ code, reason }));
  });
}

function watch(phone: Phone, page: Page): void {
  page.on('pageerror', (error) => phone.pageErrors.push(error.message));
  page.on('websocket', (ws) =>
    ws.on('framereceived', ({ payload }) => {
      const message = JSON.parse(String(payload)) as { type: string; payload: { code?: string } };
      if (message.type === 'error') phone.serverErrors.push(message.payload.code ?? '?');
    }),
  );
}

async function openRoom(
  browser: Browser,
  names: string[],
  options: Record<string, PhoneOptions> = {},
): Promise<{ phones: Phone[]; code: string }> {
  const phones: Phone[] = [];
  for (const name of names) phones.push(await openPhone(browser, name, options[name]));
  const [leader, ...rest] = phones as [Phone, ...Phone[]];
  await leader.page.getByLabel('Your name').fill(leader.name);
  await leader.page.getByRole('button', { name: 'Create Room' }).click();
  const code = (await leader.page.locator('.roomcode').innerText()).trim();
  for (const p of rest) {
    await p.page.getByLabel('Your name').fill(p.name);
    await p.page.getByRole('button', { name: 'Join Room' }).click();
    await p.page.getByLabel('Room code').fill(code);
    await p.page.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(p.page.locator('.roomcode')).toHaveText(code);
  }
  await expect(leader.page.locator('.pchip:not(.pchip--empty)')).toHaveCount(names.length);
  return { phones, code };
}

async function startGame(phones: Phone[]): Promise<void> {
  await phones[0]!.page.getByRole('button', { name: 'Start Game' }).click();
  for (const p of phones) await expect(p.page.locator('.deck__card')).toContainText('1 of');
}

async function submit(p: Phone, text: string, tap: 'click' | 'dblclick' = 'click'): Promise<void> {
  await p.page.locator('.winput__field').fill(text);
  await p.page.locator('.winput button[type=submit]')[tap]();
}

async function answerPrompts(p: Phone, total: number, from = 1): Promise<void> {
  for (let i = from; i <= total; i++) {
    await expect(p.page.locator('.deck__card')).toContainText(`${i} of ${total}`);
    await submit(p, `${p.name} ${i}`);
  }
  await expect(p.page.locator('.deck__card')).toHaveCount(0);
}

/** Waits for matchup `m` everywhere and splits phones into voters and authors. */
async function matchup(phones: Phone[], m: number, total: number) {
  for (const p of phones) {
    await expect(p.page.getByText(`Matchup ${m} of ${total}`)).toBeVisible();
  }
  const voters: Phone[] = [];
  const authors: Phone[] = [];
  for (const p of phones) {
    const open = await p.page.locator('button.vcard:not([disabled])').count();
    (open > 0 ? voters : authors).push(p);
  }
  return { voters, authors };
}

async function voteThrough(phones: Phone[], total: number, from = 1): Promise<void> {
  for (let m = from; m <= total; m++) {
    const { voters } = await matchup(phones, m, total);
    for (const v of voters) await v.page.locator('button.vcard').first().click();
    await expect(phones[0]!.page.locator('.rcard')).toHaveCount(2);
  }
}

/** A second tap is paced ~270 ms behind the first; let it reach the server before a reload. */
async function letSecondTapLand(p: Phone): Promise<void> {
  await p.page.waitForTimeout(700);
}

function expectClean(phones: Phone[]): void {
  const report = (pick: (p: Phone) => string[]) =>
    Object.fromEntries(phones.map((p) => [p.name, pick(p)]));
  const none = Object.fromEntries(phones.map((p) => [p.name, []]));
  expect(
    report((p) => p.serverErrors),
    'server errors',
  ).toEqual(none);
  expect(
    report((p) => p.pageErrors),
    'page errors',
  ).toEqual(none);
}

async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((next) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => next });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => next === 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    if (next === 'visible') {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    }
  }, state);
}

async function bootServer(port: number): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  await expect
    .poll(
      () =>
        fetch(`http://localhost:${port}/healthz`)
          .then((r) => r.ok)
          .catch(() => false),
      { timeout: 30_000 },
    )
    .toBe(true);
  return child;
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGKILL');
  await exited;
}

test('a reload or a double-tap in every phase keeps the seat, the screen and the state', async ({
  browser,
}) => {
  // Phone-like round trips, so a second tap lands before the server's answer.
  const slow = { relayLatencyMs: 150 };
  const { phones, code } = await openRoom(browser, ['Ann', 'Bob', 'Cat', 'Dan'], {
    Ann: slow,
    Bob: slow,
    Cat: slow,
    Dan: slow,
  });
  const [ann, bob, cat, dan] = phones as [Phone, Phone, Phone, Phone];

  // LOBBY: a double-tapped character stays mine through a reload; nobody is duplicated.
  await bob.page.locator('.ccell', { hasText: 'Frog' }).dblclick();
  await expect(bob.page.locator('.ccell--mine')).toContainText('Frog');
  await letSecondTapLand(bob);
  await bob.page.reload();
  await expect(bob.page.locator('.ccell--mine')).toContainText('Frog');
  await expect(ann.page.locator('.pchip:not(.pchip--empty)')).toHaveCount(4);

  // ROUND_INTRO: a double-tapped Start sends one start; a reload during the intro lands on a prompt.
  await ann.page.getByRole('button', { name: 'Start Game' }).dblclick();
  await expect(cat.page.getByText('Say Some')).toBeVisible();
  await cat.page.reload();
  for (const p of phones) await expect(p.page.locator('.deck__card')).toContainText('1 of 2');
  await expect(bob.page.locator('.corner-char .char-frog')).toHaveCount(1);

  // WRITING: a draft survives a reload; a submitted answer stays submitted.
  const danPrompt = await dan.page.locator('.deck__card .prompt').innerText();
  await dan.page.locator('.winput__field').fill('dan draft');
  await dan.page.reload();
  await expect(dan.page.locator('.deck__card .prompt')).toHaveText(danPrompt);
  await expect(dan.page.locator('.winput__field')).toHaveValue('dan draft');
  const annFirst = await ann.page.locator('.deck__card .prompt').innerText();
  await submit(ann, 'Ann 1', 'dblclick');
  await expect(ann.page.locator('.deck__card')).toContainText('2 of 2');
  await letSecondTapLand(ann);
  await ann.page.locator('.winput__field').fill('ann draft');
  await ann.page.reload();
  await expect(ann.page.locator('.deck__card')).toContainText('2 of 2');
  await expect(ann.page.locator('.deck__card .prompt')).not.toHaveText(annFirst);
  await expect(ann.page.locator('.winput__field')).toHaveValue('ann draft');
  await answerPrompts(ann, 2, 2);
  for (const p of [bob, cat, dan]) await answerPrompts(p, 2);

  // VOTING: voters and authors reload before and after voting.
  const first = await matchup(phones, 1, 4);
  const [voter, otherVoter] = first.voters as [Phone, Phone];
  const author = first.authors[0]!;
  await voter.page.reload();
  await expect(voter.page.locator('button.vcard:not([disabled])')).toHaveCount(2);
  await voter.page.locator('button.vcard').first().dblclick();
  await expect(voter.page.getByText('Vote locked')).toBeVisible();
  await letSecondTapLand(voter);
  await voter.page.reload();
  await expect(voter.page.getByText('Vote locked')).toBeVisible();
  await expect(voter.page.locator('button.vcard[disabled]')).toHaveCount(2);
  await author.page.reload();
  await expect(author.page.getByText('You wrote one of these')).toBeVisible();
  await expect(author.page.locator('button.vcard[disabled]')).toHaveCount(2);
  await otherVoter.page.locator('button.vcard').last().dblclick();

  // MATCHUP_REVEAL
  await expect(ann.page.locator('.rcard')).toHaveCount(2);
  await author.page.reload();
  await expect(author.page.locator('.rcard')).toHaveCount(2);
  await voteThrough(phones, 4, 2);

  // ROUND_RESULTS
  await expect(ann.page.getByText('Scoreboard')).toBeVisible();
  await bob.page.reload();
  await expect(bob.page.getByText('Scoreboard')).toBeVisible();
  await expect(bob.page.locator('.board__row--me')).toContainText('Bob');

  // Roast window: token counts survive reloads, the roasted overlay comes back.
  await expect(ann.page.getByText('Roast window')).toBeVisible({ timeout: 20_000 });
  await ann.page.locator('.roast__target', { hasText: 'Bob' }).dblclick();
  await expect(bob.page.getByText("YOU'VE BEEN ROASTED")).toBeVisible();
  await letSecondTapLand(ann);
  await Promise.all([ann.page.reload(), bob.page.reload(), cat.page.reload()]);
  await expect(ann.page.getByText('No token left')).toBeVisible();
  await expect(ann.page.locator('.roast__target')).toHaveCount(0);
  await expect(cat.page.locator('.roast__target:not([disabled])')).toHaveCount(3);
  await expect(bob.page.getByText("YOU'VE BEEN ROASTED")).toBeVisible();
  await bob.page.getByRole('button', { name: 'Fine.' }).click();
  await expect(bob.page.locator('.winput__count')).toContainText('/ 2 words', { timeout: 15_000 });
  for (const p of phones) await answerPrompts(p, 2);
  await voteThrough(phones, 4);
  await expect(ann.page.getByText('Scoreboard')).toBeVisible();

  // FINAL_WRITING
  await expect(cat.page.locator('.winput__count')).toContainText('/ 3 words', { timeout: 20_000 });
  await cat.page.reload();
  await expect(cat.page.locator('.winput__count')).toContainText('/ 3 words');
  await submit(ann, 'Ann final', 'dblclick');
  for (const p of [bob, cat, dan]) await submit(p, `${p.name} final`);

  // FINAL_VOTING: before and after locking in.
  await expect(bob.page.getByText('Pick your top two')).toBeVisible();
  await bob.page.reload();
  await expect(bob.page.locator('button.wcard:not([disabled])')).toHaveCount(3);
  const annCards = ann.page.locator('button.wcard:not([disabled])');
  await annCards.nth(0).click();
  await annCards.nth(1).click();
  await ann.page.getByRole('button', { name: 'Lock in' }).dblclick();
  await expect(ann.page.getByText('Votes locked')).toBeVisible();
  await letSecondTapLand(ann);
  await ann.page.reload();
  await expect(ann.page.getByText('Votes locked')).toBeVisible();
  for (const p of [bob, cat, dan]) {
    const cards = p.page.locator('button.wcard:not([disabled])');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await p.page.getByRole('button', { name: 'Lock in' }).click();
  }

  // PODIUM, then a double-tapped rematch. A leader who reloads hands leadership on (server rule).
  for (const p of phones) {
    await expect(p.page.getByRole('heading', { name: 'Podium' })).toBeVisible();
  }
  const rematch = (p: Phone) => p.page.getByRole('button', { name: 'Rematch' });
  const counts = await Promise.all(phones.map((p) => rematch(p).count()));
  const leader = phones[counts.indexOf(1)]!;
  const reloaded = phones.filter((p) => p !== leader).slice(0, 2);
  await Promise.all(reloaded.map((p) => p.page.reload()));
  for (const p of reloaded) {
    await expect(p.page.getByRole('heading', { name: 'Podium' })).toBeVisible();
    await expect(p.page.getByText('Waiting for the leader')).toBeVisible();
  }
  await rematch(leader).dblclick();
  for (const p of phones) await expect(p.page.locator('.roomcode')).toHaveText(code);
  await expect(bob.page.locator('.ccell--mine')).toContainText('Frog');
  await expect(ann.page.locator('.pchip:not(.pchip--empty)')).toHaveCount(4);
  await letSecondTapLand(leader);
  expectClean(phones);
});

test('offline 40 s mid-write and backgrounded 60 s: same seat, same prompt, draft kept', async ({
  browser,
}) => {
  const { phones } = await openRoom(browser, ['Ann', 'Bob', 'Cat'], {
    Cat: { relayLatencyMs: 0 },
  });
  const [ann, bob, cat] = phones as [Phone, Phone, Phone];
  await startGame(phones);
  await answerPrompts(ann, 2);
  const bobPrompt = await bob.page.locator('.deck__card .prompt').innerText();
  const catPrompt = await cat.page.locator('.deck__card .prompt').innerText();
  await bob.page.locator('.winput__field').fill('bob draft');
  await cat.page.locator('.winput__field').fill('cat draft');

  const wentAway = Date.now();
  await bob.context.setOffline(true);
  // Cat taps Submit as the link dies, then switches apps.
  cat.link.dead = true;
  await cat.page.locator('.winput button[type=submit]').click();
  await setVisibility(cat.page, 'hidden');

  // A dead connection is noticed within a heartbeat, and the lost submit gives the form back.
  await expect(bob.page.locator('.conn')).toBeVisible({ timeout: 25_000 });
  await expect(cat.page.locator('.winput button[type=submit]')).toHaveText('Submit', {
    timeout: 25_000,
  });
  await expect(cat.page.locator('.winput__field')).toHaveValue('cat draft');

  await bob.page.waitForTimeout(40_000 - (Date.now() - wentAway));
  await bob.context.setOffline(false);
  await expect(bob.page.locator('.conn')).toBeHidden({ timeout: 5_000 });
  await expect(bob.page.locator('.deck__card .prompt')).toHaveText(bobPrompt);
  await expect(bob.page.locator('.winput__field')).toHaveValue('bob draft');
  await answerPrompts(bob, 2);

  await cat.page.waitForTimeout(60_000 - (Date.now() - wentAway));
  const welcomesBefore = cat.link.welcomes;
  cat.link.dead = false;
  await setVisibility(cat.page, 'visible');
  await expect.poll(() => cat.link.welcomes, { timeout: 3_000 }).toBe(welcomesBefore + 1);
  await expect(cat.page.locator('.deck__card .prompt')).toHaveText(catPrompt);
  await expect(cat.page.locator('.winput__field')).toHaveValue('cat draft');
  await answerPrompts(cat, 2);

  // Three players means three matchups: nobody came back as a second seat.
  await expect(ann.page.getByText('Matchup 1 of 3')).toBeVisible();
  expectClean(phones);
});

test('two tabs on one session hand the seat back and forth without a ghost', async ({
  browser,
}) => {
  const { phones } = await openRoom(browser, ['Ann', 'Bob', 'Cat']);
  const [ann, , cat] = phones as [Phone, Phone, Phone];
  const tab2 = await cat.context.newPage();
  watch(cat, tab2);
  await tab2.goto('./');
  await expect(tab2.locator('.roomcode')).toBeVisible();

  const takenOver = cat.page.getByRole('dialog', { name: 'Open in another tab' });
  await expect(takenOver).toBeVisible();
  await tab2.locator('.ccell', { hasText: 'Frog' }).click();
  await expect(tab2.locator('.ccell--mine')).toContainText('Frog');

  await takenOver.getByRole('button', { name: 'Play here' }).click();
  await expect(takenOver).toBeHidden();
  await expect(tab2.getByRole('dialog', { name: 'Open in another tab' })).toBeVisible();
  await expect(cat.page.locator('.ccell--mine')).toContainText('Frog');
  await cat.page.locator('.ccell', { hasText: 'Bear' }).click();
  await expect(ann.page.locator('.pchip:not(.pchip--empty)')).toHaveCount(3);
  await expect(ann.page.locator('.pchip', { hasText: 'Cat' }).locator('.char-bear')).toBeVisible();
  expectClean(phones);
});

test('a double-tapped Create Room makes one room', async ({ browser }) => {
  const ann = await openPhone(browser, 'Ann', { relayLatencyMs: 150 });
  await ann.page.getByLabel('Your name').fill('Ann');
  await ann.page.getByRole('button', { name: 'Create Room' }).dblclick();
  const code = (await ann.page.locator('.roomcode').innerText()).trim();
  // Queued behind any second create, so once it lands the room can no longer change.
  await ann.page.locator('.ccell', { hasText: 'Otter' }).click();
  await expect(ann.page.locator('.ccell--mine')).toContainText('Otter');
  await expect(ann.page.locator('.roomcode')).toHaveText(code);
  expect(ann.link.welcomes).toBe(1);
  expectClean([ann]);
});

test('rejected submits and a wrong room code say so and lose nothing', async ({ browser }) => {
  const stray = await openPhone(browser, 'Eve');
  await stray.page.getByLabel('Your name').fill('Eve');
  await stray.page.getByRole('button', { name: 'Join Room' }).click();
  await stray.page.getByLabel('Room code').fill('ZZZZ');
  await stray.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(stray.page.getByRole('alert')).toHaveText('No room with that code');

  const { phones } = await openRoom(browser, ['Ann', 'Bob', 'Cat']);
  const [ann] = phones as [Phone];
  await startGame(phones);
  // Rewrite the next submit on the wire: once over the limit, once for a prompt that is not ours.
  await ann.page.evaluate(() => {
    const realSend = WebSocket.prototype.send;
    const tamper = ['over', 'wrong'];
    WebSocket.prototype.send = function (this: WebSocket, data) {
      const message = JSON.parse(String(data)) as { type: string; payload: Record<string, string> };
      const mode = message.type === 'submit_answer' ? tamper.shift() : undefined;
      if (mode === 'over') message.payload.text = Array.from({ length: 13 }, () => 'w').join(' ');
      if (mode === 'wrong') message.payload.promptId = 'not-mine';
      return realSend.call(this, mode ? JSON.stringify(message) : data);
    };
  });
  await submit(ann, 'kept answer');
  await expect(ann.page.getByRole('alert')).toHaveText("That's over the 12-word limit");
  await expect(ann.page.locator('.winput button[type=submit]')).toHaveText('Submit');
  await expect(ann.page.locator('.winput__field')).toHaveValue('kept answer');
  await ann.page.locator('.winput button[type=submit]').click();
  await expect(ann.page.getByRole('alert')).toHaveText('That prompt is not yours');
  await expect(ann.page.locator('.winput__field')).toHaveValue('kept answer');
  await ann.page.locator('.winput button[type=submit]').click();
  await expect(ann.page.locator('.deck__card')).toContainText('2 of 2');
});

test('phones with clocks 90 s off still count down from the server deadline', async ({
  browser,
}) => {
  const { phones } = await openRoom(browser, ['Ann', 'Bob', 'Cat'], {
    Bob: { clockSkewMs: 90_000 },
    Cat: { clockSkewMs: -90_000 },
  });
  await startGame(phones);
  for (const p of phones) {
    const label = p.page.locator('.header .ring__label');
    await expect(label).toHaveText(/\d+/);
    const seconds = Number(await label.innerText());
    expect(seconds, `${p.name}'s countdown`).toBeGreaterThan(80);
    expect(seconds, `${p.name}'s countdown`).toBeLessThanOrEqual(90);
  }
});

test('a server restart mid-game sends everyone home once, with a reason', async ({ browser }) => {
  test.skip(!existsSync('client/dist/index.html'), 'needs a local client build to serve');
  const port = 8093;
  const url = `http://localhost:${port}/`;
  let server = await bootServer(port);
  try {
    const { phones } = await openRoom(browser, ['Ann', 'Bob', 'Cat'], {
      Ann: { url },
      Bob: { url },
      Cat: { url },
    });
    await startGame(phones);
    await stopServer(server);
    for (const p of phones) await expect(p.page.locator('.conn')).toBeVisible();
    server = await bootServer(port);
    for (const p of phones) {
      await expect(p.page.getByRole('alert')).toHaveText('That room is gone.', { timeout: 15_000 });
      await expect(p.page.getByRole('button', { name: 'Create Room' })).toBeVisible();
      expect(await p.page.evaluate(() => localStorage.getItem('say-less.session'))).toBeNull();
    }
    // Home for good: no further join attempts.
    const sockets: string[] = [];
    phones[0]!.page.on('websocket', (ws) => sockets.push(ws.url()));
    await phones[0]!.page.waitForTimeout(2_000);
    expect(sockets).toEqual([]);
    await expect(phones[0]!.page.locator('.conn')).toBeHidden();
  } finally {
    await stopServer(server);
  }
});
