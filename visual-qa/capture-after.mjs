import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const results = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, timeout: 15000 });
  for (const [width, height] of [[1440, 900], [1280, 720], [844, 390], [393, 851]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    try {
      await page.goto(process.env.SKYLINE_QA_URL ?? 'http://127.0.0.1:3002', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const newCity = page.getByRole('button', { name: /Kota Baru/i });
      if (await newCity.count({ timeout: 3000 })) await newCity.click({ timeout: 5000 });
      await page.locator('.game-hud').waitFor({ state: 'visible', timeout: 15000 });
      const view3d = page.locator('button[aria-label="Tampilan 3D"]');
      if (await view3d.count()) await view3d.click();
      const minimizeTutorial = page.getByRole('button', { name: 'Minimalkan panduan' });
      if (await minimizeTutorial.count() && width > 768) await minimizeTutorial.click();
      await page.locator('.app-world canvas').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `visual-qa/after-${width}x${height}.png`, timeout: 60000 });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    results.push({ width, height, errors });
    await page.close();
  }
} finally {
  await writeFile('visual-qa/after-capture.json', JSON.stringify(results, null, 2));
  await browser?.close();
}
