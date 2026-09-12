import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const url = process.env.SKYLINE_QA_URL ?? 'http://127.0.0.1:3003';
await mkdir('visual-qa/gameplay', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const start = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await start.addInitScript(() => localStorage.clear());
  await start.goto(url + '?qa=start', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await start.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 15000 });
  await start.screenshot({ path: 'visual-qa/start-screen-after-1440x900.png', timeout: 20000 });
  await start.getByRole('button', { name: 'Kota Baru' }).click();
  await start.locator('.game-hud').waitFor({ state: 'visible', timeout: 15000 });
  const view2d = start.getByRole('button', { name: 'Tampilan 2D' });
  if (await view2d.count()) await view2d.click();
  await start.waitForTimeout(300);
  const info = start.getByRole('button', { name: 'Buka info views' });
  if (await info.count()) await info.click();
  const traffic = start.getByRole('button', { name: /Lalu lintas|Traffic/i }).first();
  if (await traffic.count()) await traffic.click();
  await start.waitForTimeout(250);
  await start.screenshot({ path: 'visual-qa/gameplay/traffic-overlay-1440x900.png', timeout: 20000 });
  const canvas = start.locator('.app-world canvas').first();
  const box = await canvas.boundingBox();
  if (box) await start.mouse.click(box.x + box.width * .52, box.y + box.height * .52);
  await start.waitForTimeout(250);
  await start.screenshot({ path: 'visual-qa/gameplay/inspect-mode-1440x900.png', timeout: 20000 });
  results.push({ width: 1440, height: 900, errors: [], uiMode: await start.locator('.app-shell').getAttribute('data-ui-mode') });
  await start.close();
} finally {
  await writeFile('visual-qa/remaining-capture.json', JSON.stringify(results, null, 2));
  await browser.close();
}
