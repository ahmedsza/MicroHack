import { test, expect } from '@playwright/test';

const getPrice = (amount: number) => `$${amount.toFixed(2)}`;

test.describe('Persistent cart flow', () => {
  test('adds, updates, removes, and persists cart data from the server', async ({ page }) => {
    await page.goto('/products');
    await page.evaluate(() => window.localStorage.clear());
    await page.goto('/products');

    await expect(page.locator('h1:has-text("Products")')).toBeVisible();

    const smartFeeder = page.getByRole('heading', { name: 'SmartFeeder One' });
    await expect(smartFeeder).toBeVisible();

    const feederIncrease = page.getByRole('button', { name: /increase quantity of SmartFeeder One/i });
    await feederIncrease.click();
    const feederAdd = page.getByRole('button', { name: /Add 1 SmartFeeder One to cart/i });
    await expect(feederAdd).toBeEnabled();
    await feederAdd.click();

    await expect(page.getByText('Added 1 item to cart.')).toBeVisible();

    await feederIncrease.click();
    await feederAdd.click();
    await expect(page.getByText('Added 2 items to cart.')).toBeVisible();

    const litterIncrease = page.getByRole('button', { name: /increase quantity of AutoClean Litter Dome/i });
    await litterIncrease.click();
    const litterAdd = page.getByRole('button', { name: /Add 1 AutoClean Litter Dome to cart/i });
    await expect(litterAdd).toBeEnabled();
    await litterAdd.click();

    await expect(page.getByText('Added 1 item to cart.')).toBeVisible();

    const cartLink = page.getByRole('link', { name: /^Cart$/i }).first();
    await cartLink.click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('heading', { name: 'Shopping cart' })).toBeVisible();
    await expect(page.getByText('3 items')).toBeVisible();
    await expect(page.getByText(getPrice(97.49))).toBeVisible();
    await expect(page.getByText(getPrice(149.99))).toBeVisible();
    await expect(page.getByText(getPrice(344.97))).toBeVisible();

    const smartFeederRow = page.getByText('SmartFeeder One').locator('..').locator('..').first();
    await smartFeederRow.getByRole('button', { name: /increase quantity for SmartFeeder One/i }).click();
    await expect(page.getByText('Cart updated successfully.')).toBeVisible();
    await expect(page.getByText(getPrice(194.98))).toBeVisible();
    await expect(page.getByText('4 items')).toBeVisible();

    const litterRow = page.getByText('AutoClean Litter Dome').locator('..').locator('..').first();
    await litterRow.getByRole('button', { name: /remove/i }).click();
    await expect(page.getByText('Item removed from cart.')).toBeVisible();
    await expect(page.getByText('3 items')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Shopping cart' })).toBeVisible();
    await expect(page.getByText('3 items')).toBeVisible();
    await expect(page.getByText(/SmartFeeder One|AutoClean Litter Dome/)).toBeVisible();
  });
});
