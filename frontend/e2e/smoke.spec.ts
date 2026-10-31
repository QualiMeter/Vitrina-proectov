import { expect, test, type Page } from '@playwright/test';

async function assertNoPageErrors(page: Page, visit: () => Promise<void>) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await visit();
  expect(errors).toEqual([]);
}

test('home page has accessible headings and navigation', async ({ page }) => {
  await assertNoPageErrors(page, async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Идеи встречаются/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'О платформе' })).toHaveAttribute('href', '/#about');
    await expect(page.getByRole('link', { name: 'Направления' })).toHaveAttribute('href', '/#directions');
    await expect(page.getByRole('link', { name: 'Каталог кейсов' })).toHaveAttribute('href', '/cases');
    await page.getByRole('link', { name: /Посмотреть структуру кабинета/ }).click();
    await expect(page).toHaveURL(/\/university$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Кабинет сотрудника университета' })).toBeVisible();
    await page.goto('/');
    await page.getByRole('link', { name: /Открыть каталог кейсов/ }).click();
    await expect(page).toHaveURL(/\/cases$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Кейсы для совместной работы' })).toBeVisible();
  });
});

test('implemented cabinet routes work on direct navigation and reload', async ({ page }) => {
  await assertNoPageErrors(page, async () => {
    for (const [path, heading] of [
      ['/university', 'Кабинет сотрудника университета'],
      ['/mentor', 'Кабинет куратора'],
      ['/admin', 'Кабинет администратора']
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await page.getByRole('link', { name: /на главную/ }).first().click();
      await expect(page).toHaveURL('/');
    }
  });
});

test('mobile navigation opens and closes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Открыть меню' });
  const navigation = page.getByRole('navigation', { name: 'Основная навигация' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(navigation).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'О платформе' }).click();
  await expect(page).toHaveURL(/#about$/);
  await expect(navigation).toBeHidden();
  await toggle.click();
  await toggle.click();
  await expect(navigation).toBeHidden();
});

test('375px layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ['/', '/university', '/mentor', '/admin']) {
    await page.goto(route);
    const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(widths.document, `horizontal overflow on ${route}`).toBeLessThanOrEqual(widths.viewport);
  }
});

test('unknown route shows not found state without uncaught errors', async ({ page }) => {
  await assertNoPageErrors(page, async () => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  });
});
