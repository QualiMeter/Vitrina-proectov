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
    await expect(page.getByRole('link', { name: 'Каталог кейсов', exact: true })).toHaveAttribute('href', '/cases');
    await page.getByRole('link', { name: /Посмотреть структуру кабинета/ }).click();
    await expect(page).toHaveURL(/\/university$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Кабинет сотрудника университета' })).toBeVisible();
    await page.goto('/');
    await page.getByRole('link', { name: /Открыть каталог кейсов/ }).click();
    await expect(page).toHaveURL(/\/cases$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Кейсы для совместной работы' })).toBeVisible();
    await page.goto('/');
    await page.getByRole('link', { name: /Найти опубликованный кейс/ }).click();
    await expect(page).toHaveURL(/\/cases$/);
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

test('case detail and catalogue hash navigation work from direct URLs', async ({ page }) => {
  await assertNoPageErrors(page, async () => {
    await page.goto('/cases');
    await page.getByRole('link', { name: /Подробнее о кейсе/ }).first().click();
    await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Сервис мониторинга городской среды' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Условия участия' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Участвовать' })).toBeDisabled();
    await page.getByRole('link', { name: /К каталогу/ }).click();
    await page.getByRole('link', { name: 'О платформе' }).click();
    await expect(page).toHaveURL(/\/#about$/);
    await expect(page.locator('#about')).toBeInViewport();
    await page.goto('/cases');
    await page.getByRole('link', { name: 'Направления' }).click();
    await expect(page).toHaveURL(/\/#directions$/);
    await expect(page.locator('#directions')).toBeInViewport();
  });
});

test('public company profile opens from a case and links back to its published case', async ({ page }) => {
  await assertNoPageErrors(page, async () => {
    await page.goto('/cases');
    await page.getByRole('link', { name: 'Лаборатория цифровых решений' }).click();
    await expect(page).toHaveURL(/\/companies\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Лаборатория цифровых решений' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Сервис мониторинга городской среды' })).toBeVisible();
    await page.getByRole('link', { name: /К описанию кейса/ }).click();
    await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+$/);
  });
});

test('mobile navigation opens and closes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /меню/ });
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

test('header switches cleanly between mobile and desktop widths', async ({ page }) => {
  const toggle = page.getByRole('button', { name: /меню/ });
  const navigation = page.getByRole('navigation', { name: 'Основная навигация' });

  for (const width of [400, 768, 1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    if (width <= 800) {
      await expect(toggle).toBeVisible();
      await expect(navigation).toBeHidden();
      await toggle.click();
      await expect(navigation).toBeVisible();
    } else {
      await expect(toggle).toBeHidden();
      await expect(navigation).toBeVisible();
    }
    const dimensions = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test('mobile filters stay collapsed and preserve selections when reopened', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 850 });
  await page.goto('/cases');

  const toggle = page.getByRole('button', { name: /^Фильтры(?: \d+)?$/ });
  await expect(page.getByLabel('Поиск')).toBeVisible();
  await expect(page.getByLabel('Направление')).toBeHidden();
  await toggle.click();
  const direction = page.getByLabel('Направление');
  await expect(direction).toBeVisible();
  await direction.selectOption('d1000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('button', { name: 'Фильтры 1' })).toBeVisible();
  await toggle.click();
  await expect(direction).toBeHidden();
  await page.getByRole('button', { name: 'Фильтры 1' }).click();
  await expect(direction).toHaveValue('d1000000-0000-4000-8000-000000000001');
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(direction).toHaveValue('');
});

test('375px layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const routes = [
    '/',
    '/cases',
    '/cases/a1000000-0000-4000-8000-000000000001',
    '/companies/c1000000-0000-4000-8000-000000000001',
    '/university',
    '/mentor',
    '/admin'
  ];
  for (const route of routes) {
    await page.goto(route);
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    }));
    expect(widths.document, `horizontal overflow on ${route}`).toBeLessThanOrEqual(widths.viewport);
  }
});

test('unknown route shows not found state without uncaught errors', async ({ page }) => {
  await assertNoPageErrors(page, async () => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  });
});
