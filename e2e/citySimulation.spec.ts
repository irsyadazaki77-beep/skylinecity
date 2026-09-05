import { test, expect } from '@playwright/test';

test.describe('Skyline Simulator - Full Core Loop & E2E Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure predictable start screen behavior
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test('New City, Indonesian localization, and Start Screen dismissal', async ({ page }) => {
    await page.goto('/');

    // Verify Start Screen is displayed with Indonesian localization
    const startModal = page.locator('div[role="dialog"]');
    await expect(startModal).toBeVisible();
    await expect(startModal).toContainText('Skyline Simulator');
    await expect(startModal).toContainText('Kota Baru');

    // Click "Kota Baru" to start a new city
    const newCityBtn = page.getByRole('button', { name: /Kota Baru/i });
    await expect(newCityBtn).toBeVisible();
    await newCityBtn.click();

    // Start screen modal should be dismissed
    await expect(startModal).not.toBeVisible();

    // Verify Main Game HUD with Indonesian labels
    await expect(page.locator('.game-hud')).toBeVisible();
    await expect(page.locator('.game-hud')).toContainText('Skyline Simulator');
    await expect(page.locator('.game-hud')).toContainText('Populasi');
    await expect(page.locator('.game-hud')).toContainText('Kas Kota');
  });

  test('Simulation control: start, pause, and speed adjustments', async ({ page }) => {
    await page.goto('/');

    // Dismiss start screen if present
    const newCityBtn = page.getByRole('button', { name: /Kota Baru/i });
    if (await newCityBtn.isVisible()) {
      await newCityBtn.click();
    }

    // Locate speed toolbar
    const pauseBtn = page.locator('button[aria-label="Jeda simulasi"]');
    const speed1Btn = page.locator('button[aria-label="Kecepatan normal 1x"]');
    const speed2Btn = page.locator('button[aria-label="Kecepatan cepat 2x"]');

    await expect(pauseBtn).toBeVisible();
    await expect(speed1Btn).toBeVisible();

    // The city starts in paused state (speed = 0)
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');

    // Unpause by clicking 1x speed
    await speed1Btn.click();
    await expect(speed1Btn).toHaveAttribute('aria-pressed', 'true');
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');

    // Fast forward to 2x speed
    await speed2Btn.click();
    await expect(speed2Btn).toHaveAttribute('aria-pressed', 'true');

    // Pause again
    await pauseBtn.click();
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('Building tools and zoning selection in sidebar', async ({ page }) => {
    await page.goto('/');

    const newCityBtn = page.getByRole('button', { name: /Kota Baru/i });
    if (await newCityBtn.isVisible()) {
      await newCityBtn.click();
    }

    // Select Road tool category from sidebar
    const roadCategoryBtn = page.getByRole('button', { name: /Jalan/i }).first();
    await expect(roadCategoryBtn).toBeVisible();
    await roadCategoryBtn.click();

    // Drawer should open with road options
    const roadOption = page.getByRole('button', { name: /Jalan Lokal/i }).first();
    await expect(roadOption).toBeVisible();
    await roadOption.click();

    // Select Zoning category from sidebar
    const zoningCategoryBtn = page.getByRole('button', { name: /Zona/i }).first();
    await expect(zoningCategoryBtn).toBeVisible();
    await zoningCategoryBtn.click();

    // Drawer should show zoning options
    const resZoning = page.getByRole('button', { name: /Hunian/i }).first();
    await expect(resZoning).toBeVisible();
  });

  test('Diagnostic panels and city inspector', async ({ page }) => {
    await page.goto('/');

    const newCityBtn = page.getByRole('button', { name: /Kota Baru/i });
    if (await newCityBtn.isVisible()) {
      await newCityBtn.click();
    }

    // Open Game Menu
    const menuBtn = page.locator('button[aria-haspopup="menu"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Open City Information Diagnostic Panel
    const infoOption = page.getByRole('menuitem', { name: /Informasi Kota/i });
    await expect(infoOption).toBeVisible();
    await infoOption.click();

    // Verify City Information Panel opens
    const infoPanel = page.locator('.city-information-panel');
    await expect(infoPanel).toBeVisible();
    await expect(infoPanel).toContainText(/Informasi Kota|Statistik/i);

    // Close panel
    await page.keyboard.press('Escape');
    await expect(infoPanel).not.toBeVisible();
  });

  test('3D to 2D and back to 3D mode switching', async ({ page }) => {
    await page.goto('/');

    const newCityBtn = page.getByRole('button', { name: /Kota Baru/i });
    if (await newCityBtn.isVisible()) {
      await newCityBtn.click();
    }

    // Locate 2D/3D camera toolbar controls
    const toggle2DBtn = page.locator('button[aria-label="Tampilan 2D"]');
    const toggle3DBtn = page.locator('button[aria-label="Tampilan 3D"]');

    await expect(toggle2DBtn).toBeVisible();
    await expect(toggle3DBtn).toBeVisible();

    // Switch to 2D mode
    await toggle2DBtn.click();
    await expect(toggle2DBtn).toHaveAttribute('aria-pressed', 'true');

    // Verify 2D canvas is mounted and interactive
    const canvas2D = page.locator('.city-2d-canvas');
    await expect(canvas2D).toBeVisible();
    await expect(canvas2D).toContainText('Mode 2D Taktis');

    // Switch back to 3D mode
    await toggle3DBtn.click();
    await expect(toggle3DBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.city-2d-canvas')).not.toBeVisible();
  });

  test('Save and Load management dialog', async ({ page }) => {
    await page.goto('/');

    const newCityBtn = page.getByRole('button', { name: /Kota Baru/i });
    if (await newCityBtn.isVisible()) {
      await newCityBtn.click();
    }

    // Open Game Menu
    const menuBtn = page.locator('button[aria-haspopup="menu"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Open Save/Load dialog
    const saveLoadOption = page.getByRole('menuitem', { name: /Simpan \/ Muat/i });
    await expect(saveLoadOption).toBeVisible();
    await saveLoadOption.click();

    // Verify Save/Load modal dialog opens
    const saveModal = page.locator('div[role="dialog"]');
    await expect(saveModal).toBeVisible();
    await expect(saveModal).toContainText(/Simpan|Slot/i);

    // Close dialog
    await page.keyboard.press('Escape');
    await expect(saveModal).not.toBeVisible();
  });
});
