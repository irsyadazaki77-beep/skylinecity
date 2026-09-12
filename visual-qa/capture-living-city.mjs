import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.SKYLINE_QA_URL ?? 'http://127.0.0.1:3002';
const output = 'visual-qa/living-city';
const report = { captures: [], errors: [] };
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[1440, 900], [1280, 720], [844, 390], [393, 851]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', (error) => report.errors.push({ width, height, type: 'pageerror', message: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error') report.errors.push({ width, height, type: 'console', message: message.text() });
    });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('skyline_release_intro_seen', 'true');
      localStorage.setItem('skyline_settings', JSON.stringify({ shadowQuality: 'low', renderScale: 75, trafficDensity: 'medium', vegetationDensity: 'medium', reducedMotion: true }));
    });
    await page.goto(`${baseUrl}?qa=1&audit=living-city`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    const newCity = page.getByRole('button', { name: /Kota Baru/i });
    if (await newCity.count()) await newCity.click();
    await page.locator('.game-hud').waitFor({ state: 'visible', timeout: 20_000 });
    await page.locator('.app-world canvas').first().waitFor({ state: 'visible', timeout: 20_000 });
    const minimize = page.getByRole('button', { name: 'Minimalkan panduan' });
    if (await minimize.count()) await minimize.click();
    await page.waitForTimeout(1_500);
    const path = `${output}/metropolitan-${width}x${height}.png`;
    await page.screenshot({ path, timeout: 30_000 });
    report.captures.push({ kind: 'METROPOLITAN', width, height, day: 1, path });

    if (width === 1280) {
      for (const target of [5, 10, 30]) {
        await page.goto(`${baseUrl}?qa=1&audit=living-city&day=${target}`, { waitUntil: 'domcontentloaded', timeout: 70_000 });
        const timelineNewCity = page.getByRole('button', { name: /Kota Baru/i });
        if (await timelineNewCity.count()) await timelineNewCity.click();
        await page.locator(`.game-hud[data-city-day="${target}"]`).waitFor({ state: 'visible', timeout: 55_000 });
        await page.locator('.app-world canvas').first().waitFor({ state: 'visible', timeout: 20_000 });
        const timelineMinimize = page.getByRole('button', { name: 'Minimalkan panduan' });
        if (await timelineMinimize.count()) await timelineMinimize.click();
        await page.waitForTimeout(800);
        const actualDay = Number(await page.locator('.game-hud').getAttribute('data-city-day'));
        const dayPath = `${output}/day-${target}-1280x720.png`;
        await page.screenshot({ path: dayPath, timeout: 30_000 });
        report.captures.push({ kind: 'TIMELINE', width, height, day: actualDay, requestedDay: target, path: dayPath });
      }
    }
    await page.close();
  }
} catch (error) {
  report.errors.push({ type: 'runner', message: error instanceof Error ? error.stack ?? error.message : String(error) });
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}

if (report.errors.length) process.exitCode = 1;
