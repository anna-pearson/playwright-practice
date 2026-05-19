import { test, expect, type Page, type Locator } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// SAUCE DEMO E2E TESTS
// Tests against saucedemo.com — a third-party e-commerce app we don't control.
// Covers login, inventory, cart, and checkout flows.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.saucedemo.com';
const VALID_USER = 'standard_user';
const VALID_PASS = 'secret_sauce';

// ── Page Object: Login ───────────────────────────────────────────────────────

class LoginPage {
  readonly page: Page;
  readonly usernameField: Locator;
  readonly passwordField: Locator;
  readonly loginButton: Locator;
  readonly errorMsg: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameField = page.getByPlaceholder('Username');
    this.passwordField = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.errorMsg = page.locator('[data-test="error"]');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async login(username: string, password: string) {
    await this.usernameField.fill(username);
    await this.passwordField.fill(password);
    await this.loginButton.click();
  }
}

// Helper: log in and land on inventory page (used by non-login tests)
async function loginAndGo(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(VALID_USER, VALID_PASS);
}

// ── Login ────────────────────────────────────────────────────────────────────

test.describe('Login', () => {
  test('valid credentials redirect to inventory page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(VALID_USER, VALID_PASS);
    await expect(page).toHaveURL(/inventory/);
  });

  test('locked out user sees error message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('locked_out_user', VALID_PASS);
    await expect(loginPage.errorMsg).toBeVisible();
  });

  test('invalid password shows error message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(VALID_USER, 'wrong password');
    await expect(loginPage.errorMsg).toBeVisible();
  });

  test('empty username shows error message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('', VALID_PASS);
    await expect(loginPage.errorMsg).toBeVisible();
  });
});

// ── Inventory ────────────────────────────────────────────────────────────────

test.describe('Inventory', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGo(page);
  });

  test('inventory page shows 6 products', async ({ page }) => {
    await expect(page.locator('.inventory_item')).toHaveCount(6);
  });

  test('each product has a name, price, and Add to Cart button', async ({ page }) => {
    const firstItem = page.locator('.inventory_item').first();
    await expect(firstItem.locator('.inventory_item_name')).toBeVisible();
    await expect(firstItem.locator('.inventory_item_price')).toBeVisible();
    await expect(firstItem.getByRole('button', { name: 'Add to cart' })).toBeVisible();
  });

  test('sort by price low to high', async ({ page }) => {
    await page.locator('[data-test="product-sort-container"]').selectOption('lohi');
    const prices = await page.locator('.inventory_item_price').allTextContents();

    expect(prices.length).toBeGreaterThan(1);

    for (let i = 0; i < prices.length - 1; i++) {
      const current = parseFloat(prices[i].replace('$', ''));
      const next = parseFloat(prices[i + 1].replace('$', ''));
      expect(current).toBeLessThanOrEqual(next);
    }
  });

  test('sort by name Z to A', async ({ page }) => {
    await page.locator('[data-test="product-sort-container"]').selectOption('za');
    const names = await page.locator('.inventory_item_name').allTextContents();

    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i] >= names[i + 1]).toBe(true);
    }
  });
});

// ── Cart ─────────────────────────────────────────────────────────────────────

test.describe('Cart', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGo(page);
  });

  test('adding an item updates the cart badge', async ({ page }) => {
    await page.locator('.inventory_item').first().getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
  });

  test('added item appears in the cart page', async ({ page }) => {
    await page.locator('.inventory_item').first().getByRole('button', { name: 'Add to cart' }).click();
    const productName = await page.locator('.inventory_item_name').first().textContent();
    await page.locator('.shopping_cart_link').click();
    await expect(page.locator('.inventory_item_name')).toHaveText(productName!);
  });

  test('removing an item from the cart updates the badge', async ({ page }) => {
    await page.locator('.inventory_item').first().getByRole('button', { name: 'Add to cart' }).click();
    await page.locator('.inventory_item').first().getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('.shopping_cart_badge')).not.toBeVisible();
  });
});

// ── Checkout ─────────────────────────────────────────────────────────────────

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGo(page);
    await page.locator('.inventory_item').first().getByRole('button', { name: 'Add to cart' }).click();
    await page.locator('.shopping_cart_link').click();
  });

  test('checkout button navigates to info form', async ({ page }) => {
    await page.getByRole('button', { name: 'Checkout' }).click();
    await expect(page).toHaveURL(/checkout-step-one/);
  });

  test('submitting empty checkout form shows error', async ({ page }) => {
    await page.getByRole('button', { name: 'Checkout' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-test="error"]')).toBeVisible();
  });

  test('complete checkout flow shows confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Checkout' }).click();
    await page.locator('[data-test="firstName"]').fill('Annie');
    await page.locator('[data-test="lastName"]').fill('Abrahms');
    await page.locator('[data-test="postalCode"]').fill('11237');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('.complete-header')).toHaveText('Thank you for your order!');
  });
});
