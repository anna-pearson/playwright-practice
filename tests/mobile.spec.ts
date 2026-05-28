import { test, expect, type Page } from '@playwright/test';
import { stubAudio } from './helpers/stub-audio';

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE RESPONSIVE TESTING
// Verifies the app adapts correctly to a mobile viewport (iPhone 14, 390px).
// Tests layout changes, hidden elements, touch interactions, and content
// visibility at the 640px CSS breakpoint.
// ─────────────────────────────────────────────────────────────────────────────

// Only run in the mobile project (iPhone 14 viewport)
test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only tests');
  await request.post('/api/tracks/reset');
});


test.describe('Mobile layout', () => {
  test('app renders without horizontal scrollbar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow, 'Page should not scroll horizontally on mobile').toBe(false);
  });

  test('volume controls are hidden at mobile viewport', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    await expect(page.locator('.volume-row')).not.toBeVisible();
  });

  test('genre column is hidden in the tracklist', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    await expect(page.locator('.item-genre').first()).not.toBeVisible();
  });

  test('key column is hidden in the tracklist', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    await expect(page.locator('.item-key').first()).not.toBeVisible();
  });

  test('artwork is smaller on mobile (80px)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const box = await page.locator('.artwork').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(80);
  });

  test('all 6 tracks are still visible', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('listitem')).toHaveCount(6);
  });

  test('now-playing panel is visible', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    await expect(page.locator('section[aria-label="Now playing"]')).toBeVisible();
  });

  test('transport controls are visible', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous track' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next track' })).toBeVisible();
  });

  test('search input is visible and usable', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const search = page.getByRole('searchbox', { name: 'Search tracks' });
    await expect(search).toBeVisible();

    await search.fill('midnight');
    await expect(page.getByRole('listitem')).toHaveCount(1);
  });

  test('genre filter buttons are visible', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Techno' })).toBeVisible();
  });
});

test.describe('Mobile interactions', () => {
  test('tapping a track starts playback', async ({ page }) => {
    await stubAudio(page);
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    await page.getByRole('listitem').first().click();
    await expect(page.locator('.track-title')).toHaveText('Midnight Sessions');
  });

  test('tapping a track shows it in the now-playing panel', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    await page.getByRole('listitem').nth(2).click();
    await expect(page.locator('.track-title')).toHaveText('Liquid Sunshine');
  });

  test('genre filter works on mobile', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    await page.getByRole('button', { name: 'Techno' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(1);

    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(6);
  });

  test('next/previous track buttons work', async ({ page }) => {
    await stubAudio(page);
    await page.goto('/');
    await page.getByRole('listitem').first().click();

    await expect(page.locator('.track-title')).toHaveText('Midnight Sessions');

    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(page.locator('.track-title')).toHaveText('Warehouse Echoes');

    await page.getByRole('button', { name: 'Previous track' }).click();
    await expect(page.locator('.track-title')).toHaveText('Midnight Sessions');
  });
});

test.describe('Mobile accessibility', () => {
  test('touch targets meet minimum size guidelines', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    // WCAG 2.5.8 (AA) requires 24x24px minimum; 44x44px is the AAA target.
    // We test against the AA threshold since the app's buttons are 40px.
    const buttons = page.locator('.btn-play, .btn-prev, .btn-next');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width, `Button ${i} width`).toBeGreaterThanOrEqual(24);
      expect(box!.height, `Button ${i} height`).toBeGreaterThanOrEqual(24);
    }
  });

  test('text is readable without zooming (font size >= 14px)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const fontSize = await page.locator('.track-title').evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });

    expect(fontSize).toBeGreaterThanOrEqual(14);
  });
});
