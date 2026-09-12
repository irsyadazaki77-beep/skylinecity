import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const url = process.env.SKYLINE_QA_URL ?? 'http://127.0.0.1:3002';
const viewports = [[1440, 900], [1280, 720], [844, 390], [393, 851]];
const results = [];
const browser = await chromium.launch({ headless: true });

for (const [width, height] of viewports) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const newCity = page.getByRole('button', { name: /Kota Baru/i });
    if (await newCity.count()) await newCity.click();
    await page.locator('.game-hud').waitFor({ state: 'visible' });
    const view3d = page.getByRole('button', { name: 'Tampilan 3D' });
    if (await view3d.count()) await view3d.click();

    const overflowButton = page.getByRole('button', { name: 'Buka kontrol kamera lanjutan' });
    await overflowButton.click();
    const cameraSecondary = page.locator('.camera-toolbar-secondary');
    await cameraSecondary.waitFor({ state: 'visible' });
    const cameraBox = await cameraSecondary.boundingBox();
    const cameraContained = Boolean(cameraBox && cameraBox.x >= 0 && cameraBox.y >= 0 && cameraBox.x + cameraBox.width <= width && cameraBox.y + cameraBox.height <= height);
    await page.getByRole('button', { name: 'Tutup kontrol kamera lanjutan' }).click();

    const detailButton = page.getByRole('button', { name: 'Detail', exact: true });
    let detailDisclosure = true;
    if (await detailButton.count()) {
      await detailButton.click();
      detailDisclosure = await page.locator('.tutorial-detail-content').isVisible();
      await page.getByRole('button', { name: 'Ringkas', exact: true }).click();
      detailDisclosure = detailDisclosure && !(await page.locator('.tutorial-detail-content').isVisible());
    }

    if (width <= 900) {
      const roads = page.getByRole('button', { name: /Jalan/i }).first();
      if (await roads.count()) await roads.click();
      const drawer = page.locator('.tool-drawer');
      await drawer.waitFor({ state: 'visible' });
      const box = await drawer.boundingBox();
      if (!box || box.x < 0 || box.x + box.width > width || box.y < 0 || box.y + box.height > height) errors.push('tool drawer escapes viewport');
    }

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      reducedMotionRule: [...document.styleSheets].some((sheet) => {
        try { return [...sheet.cssRules].some((rule) => rule.cssText.includes('prefers-reduced-motion')); } catch { return false; }
      }),
    }));
    results.push({ width, height, errors, cameraContained, detailDisclosure, horizontalOverflow: Math.max(layout.scrollWidth, layout.bodyScrollWidth) > layout.clientWidth, reducedMotionRule: layout.reducedMotionRule });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    results.push({ width, height, errors, cameraContained: false, detailDisclosure: false, horizontalOverflow: true, reducedMotionRule: false });
  } finally {
    await page.close();
  }
}

await browser.close();
await writeFile('visual-qa/ui-redesign-verification.json', JSON.stringify(results, null, 2));
if (results.some((result) => result.errors.length || !result.cameraContained || !result.detailDisclosure || result.horizontalOverflow || !result.reducedMotionRule)) process.exitCode = 1;
