import { expect, test, type Page } from '@playwright/test';

async function mockSession(page: Page, availableAreas = ['student', 'company', 'university', 'mentor', 'admin']) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: {
        id: 'e2e-user', email: 'user@example.com', fullName: 'Тестовый пользователь', nickname: 'tester',
        globalRoles: ['STUDENT'], availableAreas, permissions: [], companyMemberships: [],
      },
      session: { expiresAt: '2026-11-02T00:00:00Z' },
    }),
  }));
}

async function assertNoPageErrors(page: Page, visit: () => Promise<void>) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await visit();
  expect(errors).toEqual([]);
}

test('home page has accessible headings and navigation', async ({ page }) => {
  await mockSession(page);
  await assertNoPageErrors(page, async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Идеи встречаются/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'О платформе' })).toHaveAttribute('href', '#about');
    await expect(page.getByRole('link', { name: 'Направления' })).toHaveAttribute('href', '#directions');
    await expect(page.getByRole('link', { name: 'Примеры проектов' })).toHaveAttribute('href', '#projects');
    await page.getByRole('link', { name: /Посмотреть структуру кабинета/ }).click();
    await expect(page).toHaveURL(/\/university$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Кабинет сотрудника университета' })).toBeVisible();
  });
});

test('protected cabinet route shells work on direct navigation and reload', async ({ page }) => {
  await mockSession(page);
  await assertNoPageErrors(page, async () => {
    for (const [path, heading] of [
      ['/student', 'Кабинет студента'],
      ['/company', 'Кабинет компании'],
      ['/university', 'Кабинет сотрудника университета'],
      ['/mentor', 'Кабинет куратора'],
      ['/admin', 'Кабинет администратора']
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await page.goto('/');
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
  await mockSession(page);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ['/', '/student', '/company', '/university', '/mentor', '/admin']) {
    await page.goto(route);
    const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(widths.document, `horizontal overflow on ${route}`).toBeLessThanOrEqual(widths.viewport);
  }
});

test('guest is sent to login and returned to the requested cabinet after a mocked sign-in', async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, body: '{}' }));
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ csrfToken: 'csrf-token-for-e2e-1234567890' }),
  }));
  await page.route('**/api/v1/auth/login', async route => {
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-token-for-e2e-1234567890');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'e2e-user', email: 'user@example.com', fullName: 'Тестовый пользователь', globalRoles: ['UNIVERSITY_STAFF'], availableAreas: ['university'], permissions: [], companyMemberships: [] },
        session: { expiresAt: '2026-11-02T00:00:00Z' },
      }),
    });
  });
  await page.goto('/university');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Пароль').fill('password123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/university$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Кабинет сотрудника университета' })).toBeVisible();
});

test('an authenticated account without an area is denied that cabinet', async ({ page }) => {
  await mockSession(page, ['student']);
  await page.goto('/university');
  await expect(page).toHaveURL(/\/403$/);
  await expect(page.getByRole('heading', { name: 'Нет доступа' })).toBeVisible();
});

test('unknown route shows not found state without uncaught errors', async ({ page }) => {
  await assertNoPageErrors(page, async () => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  });
});
