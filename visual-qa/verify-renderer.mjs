import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('visual-qa/verification', { recursive: true });
const mode = process.env.QA_BROWSER ?? 'software';
const browser = await chromium.launch({ headless: true,
  ...(mode === 'edge' ? { channel: 'msedge' } : {}),
  args: mode === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const report = { mode, events: [], metrics: null, failure: null };
page.on('console', event => { if (['warning', 'error'].includes(event.type())) report.events.push(event.text()); });
page.on('pageerror', error => report.events.push(error.stack));
page.on('crash', () => report.events.push('Renderer process crashed'));
page.setDefaultTimeout(15000);
try {
  await page.addInitScript(() => {
    localStorage.setItem('skyline_settings', JSON.stringify({ shadowQuality: 'low', renderScale: 50, trafficDensity: 'low', vegetationDensity: 'low', reducedMotion: true }));
  });
  await page.goto('http://127.0.0.1:3006', { waitUntil: 'domcontentloaded' });
  console.log('Navigation complete');
  await page.getByRole('button', { name: /Kota Baru/i }).click();
  console.log('Started city');
  await page.waitForTimeout(3000);
  report.metrics = await page.evaluate(() => ({ text: document.body.innerText.slice(0, 1000), perf: window.__SKYLINE_PERF__, canvases: [...document.querySelectorAll('canvas')].map(c => ({ width: c.width, height: c.height })) }));
  console.log(JSON.stringify(report.metrics));
  await page.screenshot({ path: `visual-qa/verification/3d-${mode}.png`, timeout: 15000 });
  console.log('Screenshot complete');
} catch (error) { report.failure = String(error); console.log(report.failure); }
finally {
  await writeFile(`visual-qa/verification/renderer-${mode}.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
if (report.failure || report.events.some(event => event.includes('crashed'))) process.exitCode = 1;
