// Record the mic-drop moment on a phone-sized screen and save it as MP4 and GIF.
//
//   npm run build -w client && PORT=8190 npx tsx server/src/index.ts   # in one shell
//   node tools/record-micdrop.mjs --out evidence/<date>/videos [--base http://localhost:8190]
//
// Three players play round 1; Ann answers "Yes" and the voter backs it, so her win is a
// mic drop. Ann's screen is recorded at the phone's own size (WebKit will not scale the page
// into a larger video), then trimmed to the reveal, upscaled 2x and converted with a full ffmpeg fetched through uv (imageio-ffmpeg). Video only: the
// synthesized sound is not captured by the browser recorder.
import { chromium, devices, webkit } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const BASE = args.base ?? 'http://localhost:8190';
const OUT = args.out ?? `evidence/${new Date().toISOString().slice(0, 10)}/videos`;
const PROFILES = [
  { key: 'iphone', device: devices['iPhone 13'], engine: webkit },
  { key: 'android', device: devices['Pixel 7'], engine: chromium },
];

mkdirSync(OUT, { recursive: true });
const ffmpeg = execFileSync(
  'uv',
  [
    'run',
    '--quiet',
    '--with',
    'imageio-ffmpeg',
    'python',
    '-c',
    'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())',
  ],
  { encoding: 'utf8' },
).trim();

for (const profile of PROFILES) {
  const clip = await recordMicDrop(profile);
  const base = join(OUT, `mic-drop-${profile.key}`);
  // Start just before the votes land, end once the stamps have settled.
  const trim = ['-ss', clip.start.toFixed(2), '-t', clip.length.toFixed(2), '-i', clip.webm];
  execFileSync(ffmpeg, [
    '-y',
    '-loglevel',
    'error',
    ...trim,
    '-an',
    '-vf',
    'scale=iw*2:ih*2:flags=lanczos',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    `${base}.mp4`,
  ]);
  execFileSync(ffmpeg, [
    '-y',
    '-loglevel',
    'error',
    ...trim,
    '-vf',
    'fps=15,scale=390:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    `${base}.gif`,
  ]);
  rmSync(dirname(clip.webm), { recursive: true, force: true });
  console.log(`${base}.mp4 and .gif (${clip.length.toFixed(1)} s from ${clip.start.toFixed(1)} s)`);
}

async function recordMicDrop({ key, device, engine }) {
  const browser = await engine.launch();
  const videoDir = join(OUT, `.raw-${key}`);
  const contexts = [];
  const pages = {};
  for (const name of ['Ann', 'Bob', 'Cat']) {
    const recording =
      name === 'Ann' ? { recordVideo: { dir: videoDir, size: device.viewport } } : {};
    const context = await browser.newContext({ ...device, baseURL: `${BASE}/`, ...recording });
    contexts.push(context);
    pages[name] = await context.newPage();
  }
  const startedAt = Date.now();
  const { Ann: ann, Bob: bob, Cat: cat } = pages;

  await ann.goto('./');
  await ann.getByLabel('Your name').fill('Ann');
  await ann.getByRole('button', { name: 'Create Room' }).click();
  const code = (await ann.locator('.roomcode').innerText()).trim();
  for (const [page, name] of [
    [bob, 'Bob'],
    [cat, 'Cat'],
  ]) {
    await page.goto(`./?code=${code}`);
    await page.getByLabel('Your name').fill(name);
    await page.getByRole('button', { name: 'Join', exact: true }).click();
  }
  await ann.locator('.pchip__name').nth(2).waitFor();
  await ann.locator('.ccell', { hasText: 'Axolotl' }).click();
  await ann.getByRole('button', { name: 'Start Game' }).click();

  for (const [page, answer] of [
    [ann, 'Yes'],
    [bob, 'bob has quite a long answer here'],
    [cat, 'cat has quite a long answer here'],
  ]) {
    for (let i = 0; i < 2; i++) {
      await page.locator('.winput__field').waitFor({ timeout: 20_000 });
      await page.locator('.winput__field').fill(answer);
      await page.locator('.winput button[type=submit]').click();
      await page.waitForTimeout(250);
    }
  }

  // Vote through matchups until one of Ann's wins lands as a mic drop.
  let clip = null;
  while (!clip) {
    await ann.locator('.voting').waitFor({ timeout: 30_000 });
    let votedAt = 0;
    for (const page of [ann, bob, cat]) {
      const cards = page.locator('button.vcard:not([disabled])');
      if ((await cards.count()) === 0) continue;
      const yes = cards.filter({ has: page.locator('.answer-text', { hasText: /^Yes$/ }) });
      await ((await yes.count()) > 0 ? yes.first() : cards.first()).click();
      votedAt = Date.now();
    }
    await ann.locator('.reveal').waitFor({ timeout: 20_000 });
    const dropped = await ann
      .locator('.micdrop-overlay')
      .waitFor({ timeout: 3_000 })
      .then(
        () => true,
        () => false,
      );
    if (dropped) {
      await ann.waitForTimeout(4_500);
      clip = { start: Math.max((votedAt - startedAt) / 1000 - 1.5, 0), length: 7.5 };
    } else {
      await ann.locator('.voting, .results').first().waitFor({ timeout: 20_000 });
    }
  }

  const video = ann.video();
  for (const context of contexts) await context.close();
  await browser.close();
  return { ...clip, webm: await video.path() };
}
