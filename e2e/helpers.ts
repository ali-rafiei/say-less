import { type Browser, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

export interface Phone {
  name: string;
  page: Page;
}

export interface LayoutIssue {
  shot: string;
  kind: string;
  detail: string;
}

/** Screenshots every stage and records what an automated layout pass can see in it. */
export class Evidence {
  readonly issues: LayoutIssue[] = [];

  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  async openPhone(browser: Browser, name: string): Promise<Phone> {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => {
      throw new Error(`[${name}] page error: ${error.message}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && /\.(png|webp)(\?|$)/.test(response.url())) {
        this.issues.push({
          shot: name,
          kind: 'image-4xx',
          detail: `${response.status()} ${response.url()}`,
        });
      }
    });
    await page.goto('./'); // relative so a base path like /say-less/ on GitHub Pages works
    return { name, page };
  }

  async shot(page: Page, name: string, options: { fullPage?: boolean } = {}): Promise<void> {
    await page.waitForTimeout(500); // let the screen's entry animation finish
    await page.screenshot({ path: `${this.dir}/${name}.png`, fullPage: options.fullPage ?? false });
    for (const issue of await auditLayout(page))
      this.issues.push({ shot: `${name}.png`, ...issue });
  }

  save(testInfo: TestInfo): void {
    const unique = [...new Map(this.issues.map((i) => [JSON.stringify(i), i])).values()];
    writeFileSync(`${this.dir}/layout-issues.json`, `${JSON.stringify(unique, null, 2)}\n`);
    for (const issue of unique) {
      testInfo.annotations.push({
        type: `layout:${issue.kind}`,
        description: `${issue.shot}: ${issue.detail}`,
      });
    }
  }
}

/** Answers every prompt card in turn; `answer` gets the card index and the card's word limit. */
export async function answerAllPrompts(
  phone: Phone,
  answer: (index: number, limit: number) => string,
): Promise<void> {
  const { page } = phone;
  const roasted = page.locator('.overlay--roast');
  // The last submission of the round moves everyone straight on to voting.
  const done = page.locator('.waitroom, main.screen:not(.writing)');
  for (let i = 0; i < 2; i++) {
    const field = page.locator('.winput__field');
    await field.or(done).first().waitFor({ timeout: 15_000 });
    if (await roasted.isVisible()) await roasted.click();
    if (!(await field.isVisible())) return;
    const counter = await page.locator('.winput__count').innerText();
    const limit = Number(/\/\s*(\d+)/.exec(counter)?.[1]);
    await field.fill(answer(i, limit));
    await page.locator('.winput button[type=submit]').click();
    await page
      .locator(`.deck__card:has-text("${i + 2} of 2")`)
      .or(done)
      .first()
      .waitFor({ timeout: 15_000 });
  }
}

async function auditLayout(page: Page): Promise<Omit<LayoutIssue, 'shot'>[]> {
  return page.evaluate(() => {
    const found: { kind: string; detail: string }[] = [];
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const describe = (el: Element) => {
      const text = (el.getAttribute('aria-label') ?? (el as HTMLElement).innerText ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      const cls = String(el.getAttribute('class') ?? '').split(' ')[0];
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} "${text}"`;
    };
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0';
    };
    const clipper = (el: Element) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible') return a;
      }
      return null;
    };

    const doc = document.documentElement;
    if (doc.scrollWidth > vw + 1) {
      found.push({ kind: 'horizontal-scroll', detail: `scrollWidth ${doc.scrollWidth} > ${vw}` });
    }

    for (const el of document.querySelectorAll('button, a[href], input, textarea')) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) {
        found.push({
          kind: 'small-tap-target',
          detail: `${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        });
      }
      if (r.bottom <= 0 || r.top >= vh) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && !el.contains(hit) && !hit.contains(el)) {
        found.push({
          kind: 'covered-tap-target',
          detail: `${describe(el)} under ${describe(hit)}`,
        });
      }
    }

    for (const el of document.querySelectorAll('.app *')) {
      if (el.closest('.ticker') || !shown(el)) continue;
      const leaf = el.children.length === 0 || el.matches('button');
      const r = el.getBoundingClientRect();
      if (leaf && (r.right > vw + 1 || r.left < -1)) {
        const clip = clipper(el);
        found.push({
          kind: clip ? 'clipped-x' : 'overflow-x',
          detail: `${describe(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`,
        });
      }
      const s = getComputedStyle(el);
      if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
        found.push({ kind: 'truncated-text', detail: describe(el) });
      } else if (
        el.matches('button, .card') &&
        s.overflowX === 'visible' &&
        el.scrollWidth > el.clientWidth + 2
      ) {
        found.push({
          kind: 'content-overflows-box',
          detail: `${describe(el)} scrollWidth ${el.scrollWidth} > ${el.clientWidth}`,
        });
      }
    }

    const rgba = (css: string) => (css.match(/[\d.]+/g) ?? []).map(Number);
    const luminance = ([r, g, b]: number[]) => {
      const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
    };
    for (const el of document.querySelectorAll('.app *')) {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      if (!ownText || !shown(el)) continue;
      let bg: number[] | null = null;
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const c = rgba(getComputedStyle(a).backgroundColor);
        if ((c[3] ?? 1) > 0.9) {
          bg = c;
          break;
        }
        if (getComputedStyle(a).backgroundImage !== 'none') break;
      }
      if (!bg) continue;
      const [r, g, b, alpha = 1] = rgba(getComputedStyle(el).color);
      const fg = [r!, g!, b!].map((c, i) => c * alpha + bg![i]! * (1 - alpha));
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
      const ratio = (hi! + 0.05) / (lo! + 0.05);
      if (ratio < 1.5) {
        found.push({
          kind: 'invisible-text',
          detail: `${describe(el)} contrast ${ratio.toFixed(2)}:1`,
        });
      }
    }

    for (const img of document.querySelectorAll('img')) {
      if (img.complete && img.naturalWidth === 0) {
        found.push({ kind: 'broken-image', detail: img.currentSrc || img.src });
      }
    }

    const screen = document.querySelector('main.screen');
    if (screen && doc.scrollHeight <= vh + 1) {
      const kids = [...screen.children].filter(
        (k) => shown(k) && getComputedStyle(k).position !== 'fixed',
      );
      const bottom = Math.max(0, ...kids.map((k) => k.getBoundingClientRect().bottom));
      const gap = vh - bottom;
      if (gap > vh * 0.25) {
        found.push({
          kind: 'empty-space',
          detail: `${Math.round(gap)}px (${Math.round((gap / vh) * 100)}%) blank below content`,
        });
      }
    }
    return found;
  });
}
