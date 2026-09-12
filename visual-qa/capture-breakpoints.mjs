import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const baseUrl = process.env.SKYLINE_QA_URL ?? 'http://127.0.0.1:3003';
const results = [];
await mkdir('visual-qa/gameplay', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[1280, 720], [393, 851]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('skyline_release_intro_seen', 'true'); });
    await page.goto(baseUrl + '?qa=gameplay', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('.game-hud').waitFor({ state: 'visible', timeout: 20000 });
    const view2d = page.getByRole('button', { name: 'Tampilan 2D' });
    if (await view2d.count()) await view2d.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `visual-qa/gameplay/initial-city-tutorial-${width}x${height}.png`, timeout: 20000 });
    const roadRail = page.locator('.tool-rail button[title="Jalan"]');
    if (await roadRail.count()) await roadRail.click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `visual-qa/gameplay/build-road-menu-${width}x${height}.png`, timeout: 20000 });
    const localRoad = page.getByRole('button', { name: /Jalan Lokal \$25/i }).first();
    if (await localRoad.count()) await localRoad.click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `visual-qa/gameplay/road-mode-${width}x${height}.png`, timeout: 20000 });
    results.push({ width, height, errors, uiMode: await page.locator('.app-shell').getAttribute('data-ui-mode') });
    await page.close();
  }
} finally {
  await writeFile('visual-qa/breakpoint-capture.json', JSON.stringify(results, null, 2));
  await browser.close();
}
