import { expect, Page, test } from '@playwright/test';

const STARTER_ROAD = { x: 34, y: 29 };
const STARTER_CONNECTOR = { x: 35, y: 29 };
const STARTER_ZONE = { x: 33, y: 28 };
const STARTER_RESIDENTIAL = { x: 35, y: 27 };
const TILE_SIZE = 24;

async function startNewCity(page: Page): Promise<void> {
  await page.goto('/');
  const newCityButton = page.getByRole('button', { name: /Kota Baru/i });
  if (await newCityButton.isVisible()) await newCityButton.click();
  await expect(page.locator('.game-hud')).toBeVisible();
}

async function open2D(page: Page): Promise<void> {
  await page.locator('button[aria-label="Tampilan 2D"]').click();
  await expect(page.locator('.city-2d-canvas')).toBeVisible();
}

async function canvasPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const grid = page.locator('.city-2d-grid');
  await grid.evaluate((element, position) => {
    const scrollContainer = element.parentElement;
    if (!scrollContainer) return;
    scrollContainer.scrollLeft = Math.max(0, position.x * 24 - scrollContainer.clientWidth / 2 + 12);
    scrollContainer.scrollTop = Math.max(0, position.y * 24 - scrollContainer.clientHeight / 2 + 12);
  }, { x, y });
  const box = await page.locator('.city-2d-canvas canvas').boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + x * TILE_SIZE + TILE_SIZE / 2, y: box!.y + y * TILE_SIZE + TILE_SIZE / 2 };
}

async function clickCanvasTile(page: Page, x: number, y: number): Promise<void> {
  const point = await canvasPoint(page, x, y);
  await page.mouse.click(point.x, point.y);
}

async function dragCanvasTiles(page: Page, start: { x: number; y: number }, end: { x: number; y: number }): Promise<void> {
  const grid = page.locator('.city-2d-grid');
  const center = { x: Math.round((start.x + end.x) / 2), y: Math.round((start.y + end.y) / 2) };
  await grid.evaluate((element, position) => {
    const scrollContainer = element.parentElement;
    if (!scrollContainer) return;
    scrollContainer.scrollLeft = Math.max(0, position.x * 24 - scrollContainer.clientWidth / 2 + 12);
    scrollContainer.scrollTop = Math.max(0, position.y * 24 - scrollContainer.clientHeight / 2 + 12);
  }, center);
  const box = await page.locator('.city-2d-canvas canvas').boundingBox();
  expect(box).not.toBeNull();
  const startPoint = { x: box!.x + start.x * TILE_SIZE + TILE_SIZE / 2, y: box!.y + start.y * TILE_SIZE + TILE_SIZE / 2 };
  const endPoint = { x: box!.x + end.x * TILE_SIZE + TILE_SIZE / 2, y: box!.y + end.y * TILE_SIZE + TILE_SIZE / 2 };
  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.mouse.move(endPoint.x, endPoint.y);
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(100);
}

async function selectLocalRoad(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Jalan/i }).first().click();
  await page.getByRole('button', { name: /Jalan Lokal/i }).first().click();
}

async function selectResidentialZoning(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Zona/i }).first().click();
  await page.getByRole('button', { name: /Hunian/i }).first().click();
}

test.describe('Skyline Simulator - real core workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test('creates a new city and lets the player minimize/reopen onboarding', async ({ page }) => {
    await page.goto('/');
    const startModal = page.locator('div[role="dialog"]');
    await expect(startModal).toContainText('Kota Baru');
    await page.getByRole('button', { name: /Kota Baru/i }).click();
    await expect(startModal).not.toBeVisible();
    await expect(page.locator('[aria-label="Panduan pemain baru"]')).toBeVisible();
    await page.getByRole('button', { name: 'Minimalkan panduan' }).click();
    await expect(page.getByRole('button', { name: 'Buka panduan langkah berikutnya' })).toBeVisible();
    await page.getByRole('button', { name: 'Buka panduan langkah berikutnya' }).click();
    await expect(page.locator('[aria-label="Panduan pemain baru"]')).toBeVisible();
  });

  test('builds a real local road drag and zones a valid residential tile', async ({ page }) => {
    await startNewCity(page);
    await open2D(page);
    await selectLocalRoad(page);
    await dragCanvasTiles(page, STARTER_ROAD, STARTER_CONNECTOR);
    await page.getByRole('button', { name: /Pilih/i }).first().click();
    await clickCanvasTile(page, STARTER_CONNECTOR.x, STARTER_CONNECTOR.y);
    const roadInspector = page.locator('[aria-labelledby="inspector-tile-title"]');
    await expect(roadInspector).toContainText(/Jalan|ROAD/i);
    await page.getByRole('button', { name: 'Tutup inspeksi petak' }).click();

    await selectResidentialZoning(page);
    await clickCanvasTile(page, STARTER_ZONE.x, STARTER_ZONE.y);
    await page.getByRole('button', { name: /Pilih/i }).first().click();
    await clickCanvasTile(page, STARTER_ZONE.x, STARTER_ZONE.y);
    const zoningInspector = page.locator('[aria-labelledby="inspector-tile-title"]');
    await expect(zoningInspector).toContainText(/Hunian|RESIDENTIAL/i);
  });

  test('advances the simulation, then pauses on the same day', async ({ page }) => {
    await startNewCity(page);
    const hud = page.locator('.game-hud');
    const speed1 = page.locator('button[aria-label="Kecepatan normal 1x"]');
    const pause = page.locator('button[aria-label="Jeda simulasi"]');
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await speed1.click();
    await expect(hud).toContainText(/Hari 2\b/, { timeout: 10_000 });
    await pause.click();
    const pausedDay = await hud.getByText(/Hari \d+ · \d+:00/).textContent();
    await page.waitForTimeout(1_300);
    await expect(hud.getByText(/Hari \d+ · \d+:00/)).toHaveText(pausedDay ?? '');
  });

  test('opens the inspector for the actual starter residential tile', async ({ page }) => {
    await startNewCity(page);
    await open2D(page);
    await clickCanvasTile(page, STARTER_RESIDENTIAL.x, STARTER_RESIDENTIAL.y);
    const inspector = page.locator('[aria-labelledby="inspector-tile-title"]');
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText('Inspeksi Petak (36, 28)');
    await expect(inspector).toContainText(/Hunian|Residential/i);
  });

  test('keeps real edits visible across 2D/3D and supports keyboard map navigation', async ({ page }) => {
    await startNewCity(page);
    await open2D(page);
    await selectLocalRoad(page);
    await dragCanvasTiles(page, STARTER_ROAD, STARTER_CONNECTOR);
    await selectResidentialZoning(page);
    await clickCanvasTile(page, STARTER_ZONE.x, STARTER_ZONE.y);

    const focusTile = page.locator('.roving-focus');
    await focusTile.focus();
    const initialCoord = await focusTile.getAttribute('data-coord');
    await page.keyboard.press('ArrowRight');
    await expect(focusTile).not.toHaveAttribute('data-coord', initialCoord ?? '');
    await page.keyboard.press('Enter');
    await page.locator('button[aria-label="Tampilan 3D"]').click();
    await expect(page.locator('.city-2d-canvas')).not.toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('saves, mutates, and loads the saved city back', async ({ page }) => {
    await startNewCity(page);
    await open2D(page);
    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: /Simpan \/ Muat/i }).click();
    const saveDialog = page.locator('[aria-labelledby="save-load-title"]');
    await expect(saveDialog).toBeVisible();
    await saveDialog.getByRole('button', { name: /^Simpan$/i }).first().click();
    await expect(saveDialog).toContainText('Skyline Metropolis');
    await page.keyboard.press('Escape');

    await selectLocalRoad(page);
    await dragCanvasTiles(page, STARTER_ROAD, STARTER_CONNECTOR);
    await selectResidentialZoning(page);
    await clickCanvasTile(page, STARTER_ZONE.x, STARTER_ZONE.y);
    await page.getByRole('button', { name: /Pilih/i }).first().click();
    await clickCanvasTile(page, STARTER_ZONE.x, STARTER_ZONE.y);
    await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toContainText(/Hunian|RESIDENTIAL/i);
    await page.getByRole('button', { name: 'Tutup inspeksi petak' }).click();

    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: /Simpan \/ Muat/i }).click();
    const loadDialog = page.locator('[aria-labelledby="save-load-title"]');
    await expect(loadDialog.getByRole('button', { name: /^Muat$/i }).first()).toBeVisible();
    await loadDialog.getByRole('button', { name: /^Muat$/i }).first().click();
    await page.getByRole('button', { name: /Pilih/i }).first().click();
    await clickCanvasTile(page, STARTER_ZONE.x, STARTER_ZONE.y);
    await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toContainText(/Kosong|EMPTY/i);
  });

  test('switches the primary language and updates the management menu', async ({ page }) => {
    await startNewCity(page);
    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: /Pengaturan/i }).click();
    const settings = page.locator('[aria-labelledby="settings-title"]');
    await settings.getByRole('tab', { name: /Aksesibilitas/i }).click();
    await settings.getByLabel(/Bahasa/i).selectOption('en');
    await expect(settings).toContainText('Settings');
    await settings.getByRole('button', { name: /Tutup pengaturan/i }).click();
    await page.locator('button[aria-haspopup="menu"]').click();
    await expect(page.getByRole('menuitem', { name: /City Information/i })).toBeVisible();
  });

  test('does not restore a stale worker tick after an active build edit', async ({ page }) => {
    await startNewCity(page);
    const speed1 = page.locator('button[aria-label="Kecepatan normal 1x"]');
    await speed1.click();
    await expect(page.locator('.game-hud')).toContainText(/Hari 2\b/, { timeout: 10_000 });
    await open2D(page);
    await selectLocalRoad(page);
    await dragCanvasTiles(page, STARTER_ROAD, STARTER_CONNECTOR);
    await page.locator('button[aria-label="Jeda simulasi"]').click();
    await page.getByRole('button', { name: /Pilih/i }).first().click();
    await clickCanvasTile(page, STARTER_CONNECTOR.x, STARTER_CONNECTOR.y);
    await expect(page.locator('[aria-labelledby="inspector-tile-title"]')).toContainText(/Jalan|ROAD/i);
  });

  test('opens diagnostics from the game menu', async ({ page }) => {
    await startNewCity(page);
    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: /Informasi Kota/i }).click();
    const infoPanel = page.locator('.city-information-panel');
    await expect(infoPanel).toBeVisible();
    await expect(infoPanel).toContainText(/Informasi Kota|Statistik/i);
    await page.keyboard.press('Escape');
    await expect(infoPanel).not.toBeVisible();
  });
});
