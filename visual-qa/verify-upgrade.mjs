import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'visual-qa/upgrade';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = [];
try {
  for (const fixture of [{ name: 'desktop', width: 1280, height: 720 }, { name: 'mobile', width: 393, height: 851 }, { name: 'dense', width: 1280, height: 720, dense: true }]) {
    const page = await browser.newPage({ viewport: { width: fixture.width, height: fixture.height }, hasTouch: fixture.name === 'mobile' });
    page.setDefaultTimeout(30000);
    const row = { ...fixture, errors: [], checks: [] };
    report.push(row);
    console.log(`Checking ${fixture.name}`);
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
    await page.addInitScript(() => localStorage.setItem('skyline_settings', JSON.stringify({ shadowQuality: 'low', renderScale: 65, trafficDensity: 'low', vegetationDensity: 'low', reducedMotion: true, adaptiveQuality: false })));
    try {
      await page.goto(`http://localhost:3006/?debug=1${fixture.dense ? '&audit=living-city' : ''}`, { waitUntil: 'domcontentloaded' });
      console.log(`${fixture.name}: loaded`);
      await page.getByRole('button', { name: /Kota Baru/i }).click();
      await page.waitForFunction(() => window.__SKYLINE_CAMERA__?.snapshot().target);
      console.log(`${fixture.name}: WebGL ready`);
      await page.getByRole('button', { name: 'Minimalkan panduan' }).click();
      const snapshot = () => page.evaluate(() => window.__SKYLINE_CAMERA__.snapshot());
      const project = (x, y) => page.evaluate(([x, y]) => window.__SKYLINE_CAMERA__.project(x - 29.5, y - 29.5), [x, y]);
      await page.waitForTimeout(1000);
      const initial = await snapshot();
      const canvas = page.locator('.app-world canvas');
      await canvas.hover({ position: { x: fixture.width / 2, y: fixture.height / 2 } });
      await page.keyboard.down('ArrowRight');
      try { await expect.poll(async () => (await snapshot()).target, { timeout: 15000 }).not.toEqual(initial.target); }
      finally { await page.keyboard.up('ArrowRight'); }
      const panned = await snapshot();
      expect(panned.target).not.toEqual(initial.target);
      await page.keyboard.press('e');
      await page.waitForTimeout(700);
      const rotated = await snapshot();
      expect(Math.hypot(...rotated.target.map((v, i) => v - panned.target[i]))).toBeLessThan(0.1);
      await page.getByRole('button', { name: 'Perbesar kamera (Zoom In)', exact: true }).click();
      await page.waitForTimeout(700);
      const zoomed = await snapshot();
      expect(Math.hypot(...zoomed.target.map((v, i) => v - panned.target[i]))).toBeLessThan(0.1);
      await page.keyboard.press('Home');
      await page.waitForTimeout(700);
      const home = await snapshot();
      expect(Math.hypot(...home.target.map((v, i) => v - initial.target[i]))).toBeLessThan(0.1);
      row.checks.push('camera keyboard pan, rotate, zoom preserves target, Home reset');
      if (fixture.name === 'mobile') {
        const cdp = await page.context().newCDPSession(page);
        const before = await snapshot();
        await page.keyboard.press('j');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 155, y: 360, id: 0 }, { x: 235, y: 360, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 115, y: 380, id: 0 }, { x: 275, y: 380, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(1000);
        expect((await snapshot()).position).not.toEqual(before.position);
        await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toHaveCount(0);
        row.checks.push('two-finger pinch/rotate while building cancels placement');
        await page.keyboard.press('Home');
      }
      if (fixture.name === 'desktop') {
        await page.getByRole('button', { name: /Jalan/i }).first().click();
        await page.getByRole('button', { name: /Jalan Lokal/i }).first().click();
        const start = await project(34, 29), end = await project(35, 29);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 12 });
        await page.waitForTimeout(500);
        await page.mouse.up();
        await page.getByRole('button', { name: /Pilih/i }).first().click();
        await page.mouse.click(end.x, end.y);
        await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toContainText(/Jalan|ROAD/);
        await page.getByRole('button', { name: 'Tutup inspeksi petak' }).click();
        row.checks.push('3D road drag and actual tile inspector');
        await page.mouse.move(620, 350);
        await page.mouse.down();
        await page.mouse.move(690, 360, { steps: 12 });
        await page.mouse.up();
        await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toHaveCount(0);
        row.checks.push('left drag pans without selecting');
        await page.keyboard.press('Home');
        await page.waitForTimeout(1000);
        await page.keyboard.press('z');
        const zone = await project(33, 28);
        await page.mouse.click(zone.x, zone.y);
        await page.getByRole('button', { name: /Pilih/i }).first().click();
        await page.mouse.click(zone.x, zone.y);
        await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toContainText(/Hunian|RESIDENTIAL/i);
        await page.getByRole('button', { name: 'Tutup inspeksi petak' }).click();
        row.checks.push('3D residential zoning');
        await page.getByRole('button', { name: 'Buka info views' }).click();
        await page.getByRole('button', { name: 'Sampah', exact: true }).click();
        await expect(page.getByLabel('Legenda layanan kota')).toBeVisible();
        await page.getByRole('button', { name: 'Sampah', exact: true }).click();
        row.checks.push('service overlay and readable legend');
        await page.getByRole('button', { name: 'Tutup info views' }).click();
        await page.getByRole('button', { name: 'Menu Pengelolaan' }).click();
        await page.getByRole('menuitem', { name: /Simpan \/ Muat/i }).click();
        await page.locator('[aria-labelledby="save-load-title"]').getByRole('button', { name: /^Simpan$/ }).first().click();
        await page.keyboard.press('Escape');
        await page.keyboard.press('b');
        await page.mouse.click(zone.x, zone.y);
        await page.getByRole('button', { name: /Pilih/i }).first().click();
        await page.mouse.click(zone.x, zone.y);
        await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toContainText(/Kosong|EMPTY/i);
        await page.getByRole('button', { name: 'Tutup inspeksi petak' }).click();
        await page.keyboard.press('Control+z');
        await page.mouse.click(zone.x, zone.y);
        await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toContainText(/Hunian|RESIDENTIAL/i);
        row.checks.push('3D bulldozer and undo');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Menu Pengelolaan' }).click();
        await page.getByRole('menuitem', { name: /Simpan \/ Muat/i }).click();
        await page.locator('[aria-labelledby="save-load-title"]').getByRole('button', { name: /^Muat$/ }).first().click();
        await page.waitForFunction(() => window.__SKYLINE_CAMERA__?.snapshot().target);
        const savedZone = await project(33, 28);
        await page.mouse.click(savedZone.x, savedZone.y);
        await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toContainText(/Hunian|RESIDENTIAL/i);
        await page.getByRole('button', { name: 'Tutup inspeksi petak' }).click();
        row.checks.push('save, page reload, load retains 3D zoning');
        await page.getByRole('button', { name: 'Kecepatan sangat cepat 3x', exact: true }).click();
        await expect.poll(async () => Number(await page.locator('.game-hud').getAttribute('data-city-population')), { timeout: 45000 }).toBeGreaterThan(0);
        await page.getByRole('button', { name: 'Jeda simulasi', exact: true }).click();
        const pausedDay = await page.locator('.game-hud').getAttribute('data-city-day');
        await page.waitForTimeout(1500);
        expect(await page.locator('.game-hud').getAttribute('data-city-day')).toBe(pausedDay);
        row.checks.push('3D simulation growth, fast speed, pause');
      }
      await page.waitForTimeout(5000);
      row.metrics = await page.evaluate(() => ({ ...window.__SKYLINE_PERF__, overflow: document.documentElement.scrollWidth > innerWidth }));
      await page.screenshot({ path: `${output}/${fixture.name}.png`, timeout: 30000 });
      expect(row.errors).toEqual([]);
      expect(row.metrics.overflow).toBe(false);
    } catch (error) {
      row.failure = String(error);
      row.ui = await page.evaluate(() => ({ focus: document.activeElement?.tagName, dialogs: [...document.querySelectorAll('[aria-modal="true"]')].map(e => e.textContent.slice(0, 200)) })).catch(() => null);
      await page.screenshot({ path: `${output}/${fixture.name}-failure.png`, timeout: 10000 }).catch(() => {});
    }
    console.log(JSON.stringify(row));
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
if (report.some(row => row.failure || row.errors.length)) process.exitCode = 1;
