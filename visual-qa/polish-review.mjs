import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('visual-qa/polish', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
const results = [];
const render3D = process.env.SKYLINE_QA_3D === '1';
try {
  for (const [width, height] of (render3D ? [[1280, 720]] : [[1440, 900], [393, 851], [844, 390]])) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(20000);
    await page.addInitScript(() => {
      localStorage.setItem('skyline_settings', JSON.stringify({ shadowQuality: 'low', renderScale: 50, trafficDensity: 'low', vegetationDensity: 'low', reducedMotion: true }));
    });
    try {
      await page.goto('http://127.0.0.1:3006', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Kota Baru/i }).waitFor();
      await page.screenshot({ path: `visual-qa/polish/start-${width}.png`, timeout: 20000 });
      await page.getByRole('button', { name: /Kota Baru/i }).click();
      if (!render3D) {
        await page.getByRole('button', { name: 'Tampilan 2D', exact: true }).click();
        await page.locator('.city-2d-canvas').waitFor();
      } else await page.locator('.app-world canvas').waitFor();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `visual-qa/polish/city-${width}.png`, timeout: 20000 });
      if (!render3D) {
        const action = page.getByRole('button', { name: 'Lakukan Sekarang', exact: true });
        await expect(action).toBeInViewport({ ratio: 1 });
        await page.getByRole('button', { name: 'Minimalkan panduan', exact: true }).click();
        await page.getByRole('button', { name: 'Menu Pengelolaan', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Pengaturan Kota', exact: true }).click();
        await page.getByRole('tab', { name: 'Grafis', exact: true }).click();
        await page.getByRole('button', { name: 'Seimbang 100% · Medium', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Seimbang 100% · Medium', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.screenshot({ path: `visual-qa/polish/settings-${width}.png`, timeout: 20000 });
        await page.getByRole('tab', { name: 'Grafis', exact: true }).press('ArrowRight');
        await expect(page.getByRole('tab', { name: 'Audio', exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.getByRole('button', { name: 'Tutup pengaturan', exact: true }).click();
      }
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        canvas: Boolean(document.querySelector('.app-world canvas')),
        hud: document.querySelector('.game-hud')?.getBoundingClientRect().toJSON(),
      }));
      results.push({ width, height, errors, layout });
    } catch (error) { results.push({ width, height, errors, failure: String(error) }); }
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(`visual-qa/polish/results${render3D ? '-3d' : ''}.json`, JSON.stringify(results, null, 2));
}
