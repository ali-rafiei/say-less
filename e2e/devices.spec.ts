import { expect, test } from '@playwright/test';
import { Evidence } from './helpers.ts';

// Rough height of a phone's software keyboard; Playwright cannot open the real one.
const KEYBOARD_PX = 300;

test('smoke: home, how to play, three phones reach writing and submit', async ({
  browser,
}, testInfo) => {
  const evidence = new Evidence(`${process.env.SHOTS_DIR ?? 'e2e/shots'}/${testInfo.project.name}`);
  const ann = await evidence.openPhone(browser, 'Ann');
  const { page } = ann;

  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
  await evidence.shot(page, '01-home');
  await page.getByRole('button', { name: 'How to play' }).click();
  const help = page.getByRole('dialog', { name: 'How to play' });
  await expect(help).toBeVisible();
  await evidence.shot(page, '02-how-to-play');
  await page.locator('.howto__list').evaluate((list) => list.scrollTo(0, list.scrollHeight));
  await evidence.shot(page, '02b-how-to-play-end');
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(help).toHaveCount(0);

  await page.getByLabel('Your name').fill('Ann');
  await evidence.shot(page, '03-home-named');
  await page.getByRole('button', { name: 'Create Room' }).click();
  const code = (await page.locator('.roomcode').innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
  await evidence.shot(page, '04-lobby-alone');

  const guests = [];
  for (const name of ['Bartholomew', 'Cat']) {
    const guest = await evidence.openPhone(browser, name);
    await guest.page.getByLabel('Your name').fill(name);
    await guest.page.getByRole('button', { name: 'Join Room' }).click();
    await guest.page.getByLabel('Room code').fill(code);
    if (name === 'Cat') await evidence.shot(guest.page, '05-join-form');
    await guest.page.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(guest.page.locator('.roomcode')).toHaveText(code);
    guests.push(guest);
  }
  await expect(page.locator('.pchip__name')).toHaveCount(3);
  await evidence.shot(page, '06-lobby-three');
  await evidence.shot(page, '06b-lobby-three-full', { fullPage: true });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await evidence.shot(page, '06c-lobby-bottom');
  await evidence.shot(guests[0]!.page, '06d-lobby-guest');

  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByText('Say Some')).toBeVisible();
  await evidence.shot(page, '07-round-intro');
  const field = page.locator('.winput__field');
  await expect(field).toBeVisible();
  await evidence.shot(page, '08-writing');

  await field.fill('Soggy lasagna delivered by pigeons');
  await expect(page.locator('.winput__count')).toHaveText(/^5 \/ 12 words$/);
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.width, height: viewport.height - KEYBOARD_PX });
  await field.focus();
  await page.waitForTimeout(600); // the field scrolls itself into view 250 ms after focus
  const submit = page.locator('.winput button[type=submit]');
  const box = await submit.boundingBox();
  if (!box || box.y + box.height > viewport.height - KEYBOARD_PX || box.y < 0) {
    evidence.issues.push({
      shot: '09-writing-keyboard.png',
      kind: 'hidden-by-keyboard',
      detail: `Submit at y=${Math.round(box?.y ?? -1)} with ${viewport.height - KEYBOARD_PX}px visible`,
    });
  }
  await evidence.shot(page, '09-writing-keyboard');
  await page.setViewportSize(viewport);

  await submit.click();
  await expect(page.locator('.deck__card', { hasText: '2 of 2' })).toBeVisible();
  await evidence.shot(page, '10-second-prompt');
  evidence.save(testInfo);
});
