import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.SKYLINE_BASE_URL ?? 'http://127.0.0.1:3002';
const outputDir = 'visual-qa/performance';
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const sizes = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '844x390', width: 844, height: 390 },
  { name: '393x851', width: 393, height: 851 },
];
const rows = [];
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()); });
  page.setDefaultTimeout(5000);
  let navigationError = null;
  const profileUrl = new URL(baseURL);
  profileUrl.searchParams.set('debug', '1');
  try { await page.goto(profileUrl.href, { waitUntil: 'domcontentloaded', timeout: 10000 }); }
  catch (error) { navigationError = String(error); }
  const start = page.getByRole('button', { name: /new city|kota baru|start|mulai/i }).first();
  if (!navigationError && await start.count()) await start.click();
  await page.waitForTimeout(1000);
  let screenshotError = null;
  try {
    await page.screenshot({ path: `${outputDir}/gameplay-${size.name}.png`, fullPage: false, timeout: 10000 });
  } catch (error) {
    screenshotError = String(error);
  }
  await page.waitForTimeout(8000);
  const metrics = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    perf: window.__SKYLINE_PERF__ ?? null,
    navigation: performance.getEntriesByType('navigation').map((entry) => ({ type: entry.type, duration: entry.duration })),
  }));
  rows.push({ ...size, navigationError, screenshotError, pageErrors, ...metrics });
  await page.close();
}
await fs.writeFile(`${outputDir}/browser-profile.json`, JSON.stringify({ capturedAt: new Date().toISOString(), baseURL, rows }, null, 2));
console.log(JSON.stringify({ outputDir, rows }, null, 2));
await browser.close();
