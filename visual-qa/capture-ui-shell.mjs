import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
try {
  for (const [width, height] of [[1440, 900], [1280, 720], [393, 851]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(process.env.SKYLINE_QA_URL ?? 'http://127.0.0.1:3002', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.screenshot({ path: `visual-qa/ui-shell-after-${width}x${height}.png`, fullPage: false });
    await page.close();
  }
} finally {
  await browser.close();
}
