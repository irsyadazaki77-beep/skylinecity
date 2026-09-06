import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [width, height] of [[1440, 900], [1280, 720], [393, 851]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    await page.goto('http://127.0.0.1:3012');
    await page.getByRole('button', { name: /Kota Baru/i }).click();
    await page.locator('.game-hud').waitFor();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `visual-qa/before-${width}x${height}.png` });
    const timing = await page.evaluate(() => new Promise(resolve => {
      const samples = [];
      let previous = performance.now();
      function frame(now) {
        samples.push(now - previous);
        previous = now;
        if (samples.length < 120) requestAnimationFrame(frame);
        else {
          samples.sort((a, b) => a - b);
          resolve({ p50: samples[60], p95: samples[114], note: 'Headless browser RAF, not GPU timing' });
        }
      }
      requestAnimationFrame(frame);
    }));
    results.push({ width, height, errors, timing });
    await page.close();
  }
} finally {
  await writeFile('visual-qa/baseline-browser.json', JSON.stringify(results, null, 2));
  await browser.close();
}
