import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// PRACTICE EXERCISES
// Interview-style test writing exercises against hypothetical apps.
// These won't run against a real server — they're for studying patterns.
// ─────────────────────────────────────────────────────────────────────────────

// ── Exercise 1: Login form ───────────────────────────────────────────────────

test.describe('Exercise 1: Login form', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@email.com');
    await page.getByLabel('Password').fill('testPass');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('wrong password shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@email.com');
    await page.getByLabel('Password').fill('WRONGPASS');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('empty email shows validation error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('');
    await page.getByLabel('Password').fill('WRONGPASS');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.locator('.error-message')).toBeVisible();
  });
});

// ── Exercise 2: Shopping cart ────────────────────────────────────────────────

test.describe('Exercise 2: Shopping cart', () => {
  test('clicking Add to Cart updates badge from 0 to 1', async ({ page }) => {
    await page.goto('/product');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.locator('.cart-badge')).toHaveText('1');
  });

  test('clicking Add to Cart three times shows 3 in badge', async ({ page }) => {
    await page.goto('/product');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.locator('.cart-badge')).toHaveText('3');
  });
});

// ���─ Exercise 3: Dropdown filter ──────────────────────────────────────────────

test.describe('Exercise 3: Dropdown filter', () => {
  test('selecting Engineering shows only 2 engineering employees', async ({ page }) => {
    await page.goto('/dept');
    await page.getByLabel('Department').selectOption('engineering');
    await expect(page.getByRole('listitem')).toHaveCount(2);
  });

  test('selecting All after filtering restores the full list', async ({ page }) => {
    await page.goto('/dept');
    await page.getByLabel('Department').selectOption('engineering');
    await page.getByLabel('Department').selectOption('');
    await expect(page.getByRole('listitem')).toHaveCount(4);
  });
});

// ── Exercise 4: Async loading ────────────────────────────────────────────────

test.describe('Exercise 4: Async loading', () => {
  test('searching shows spinner then results', async ({ page }) => {
    await page.goto('/search');
    await page.getByLabel('Search Products').fill('laptop');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('.spinner')).toBeVisible();
    await expect(page.locator('.spinner')).not.toBeVisible();
    await expect(page.locator('.results').getByRole('listitem')).not.toHaveCount(0);
  });
});
