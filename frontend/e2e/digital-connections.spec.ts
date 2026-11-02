import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const screenshotDir = fileURLToPath(new URL('../../docs/screenshots/digital-connections/', import.meta.url));

const captures = [
  { path: '/', width: 1920, file: 'home-1920.png' },
  { path: '/', width: 1280, file: 'home-1280.png' },
  { path: '/', width: 375, file: 'home-375.png' },
  { path: '/demo/student', width: 1280, file: 'student-1280.png' },
  { path: '/demo/student', width: 375, file: 'student-375.png' },
  { path: '/university', width: 1280, file: 'university-1280.png' },
] as const;

async function mockGuest(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, body: '{}' }));
}

async function mockSession(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'user', email: 'user@example.com', fullName: 'Тестовый пользователь', globalRoles: ['STUDENT', 'UNIVERSITY_STAFF'], availableAreas: ['student', 'university'], permissions: [], companyMemberships: [] }, session: { expiresAt: '2026-12-01T00:00:00Z' } }),
  }));
}

test('digital connections stays decorative across layouts', async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  await mockGuest(page);
  for (const { path, width, file } of captures) {
    if (path === '/university') await mockSession(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const ambient = page.locator('.ambient');
    await expect(ambient).toHaveCount(1);
    await expect(ambient).toHaveAttribute('aria-hidden', 'true');
    await expect(ambient).toHaveCSS('pointer-events', 'none');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}px`).toBe(true);
    await page.screenshot({ path: resolve(screenshotDir, file), fullPage: true, animations: 'disabled' });
  }

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /меню/ }).click();
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await page.goto('/demo/student');
  await page.getByRole('button', { name: 'Разделы' }).click();
  await expect(page.getByRole('navigation', { name: 'Кабинет студента' })).toBeVisible();
});

test('reduced motion removes decorative animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.ambient__art')).toHaveCSS('animation-name', 'none');
});

for (const width of [320, 375, 400, 768, 1280, 1920]) {
  test(`decorated layouts fit ${width}px without horizontal overflow`, async ({ page }) => {
    await mockGuest(page);
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/demo/student', '/university']) {
      if (path === '/university') await mockSession(page);
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}px`).toBe(true);
    }
  });
}
