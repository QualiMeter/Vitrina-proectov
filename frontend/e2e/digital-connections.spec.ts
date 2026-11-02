import { expect, test } from '@playwright/test';

const captures = [
  { path: '/', width: 1920, file: 'home-1920.png' },
  { path: '/', width: 1280, file: 'home-1280.png' },
  { path: '/', width: 375, file: 'home-375.png' },
  { path: '/demo/student', width: 1280, file: 'student-1280.png' },
  { path: '/demo/student', width: 375, file: 'student-375.png' },
  { path: '/university', width: 1280, file: 'university-1280.png' },
] as const;

test('digital connections stays decorative across layouts', async ({ page }) => {
  for (const { path, width, file } of captures) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const ambient = page.locator('.ambient');
    await expect(ambient).toHaveCount(1);
    await expect(ambient).toHaveAttribute('aria-hidden', 'true');
    await expect(ambient).toHaveCSS('pointer-events', 'none');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}px`).toBe(true);
    await page.screenshot({ path: `../docs/screenshots/digital-connections/${file}`, fullPage: true, animations: 'disabled' });
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
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/demo/student', '/university']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}px`).toBe(true);
    }
  });
}
