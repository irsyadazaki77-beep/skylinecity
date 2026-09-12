import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.SKYLINE_QA_URL ?? 'http://127.0.0.1:3003';
const sizes = [[1440, 900], [1280, 720], [393, 851]];
const results = [];
await mkdir('visual-qa/gameplay', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      localStorage.setItem('skyline_release_intro_seen', 'true');
      localStorage.clear();
      localStorage.setItem('skyline_release_intro_seen', 'true');
    });
    await page.goto(baseUrl + '?qa=gameplay', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('.game-hud').waitFor({ state: 'visible', timeout: 20000 });
    const view2d = page.getByRole('button', { name: 'Tampilan 2D' });
    if (await view2d.count()) await view2d.click();
    await page.waitForTimeout(1800);
    const capture = async (name) => {
      await page.screenshot({ path: `visual-qa/gameplay/${name}-${width}x${height}.png`, timeout: 60000 });
    };
    await capture('initial-city-tutorial');
    const doNow = page.getByRole('button', { name: 'Lakukan Sekarang' });
    if (await doNow.count()) await doNow.click();
    await page.waitForTimeout(400);
    await capture('tutorial-target-road');
    const roadRail = page.locator('.tool-rail button[title="Jalan"]');
    if (await roadRail.count()) await roadRail.click();
    await page.waitForTimeout(300);
    await capture('build-road-menu');
    const clean = page.getByRole('button', { name: /Clean City View/i });
    if (await clean.count()) { await clean.click(); await page.waitForTimeout(300); await capture('clean-city-view'); await clean.click(); }
    const overlay = page.getByRole('button', { name: /Buka info views/i });
    if (await overlay.count()) { await overlay.click(); await page.waitForTimeout(250); await capture('overlay-menu'); }
    const canvas = page.locator('.app-world canvas').first();
    if (await canvas.count()) {
      const box = await canvas.boundingBox();
      if (box) await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.52);
    }
    await page.waitForTimeout(300);
    await capture('inspect-mode');
    results.push({ width, height, errors, uiMode: await page.locator('.app-shell').getAttribute('data-ui-mode') });
    await page.close();
  }
} finally {
  await writeFile('visual-qa/gameplay-capture.json', JSON.stringify(results, null, 2));
  await browser.close();
}
