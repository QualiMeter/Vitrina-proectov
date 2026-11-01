import { expect, test } from '@playwright/test';

for (const width of [320, 375, 400]) {
  test(`mobile keyboard navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /меню/ });
    const nav = page.getByRole('navigation', { name: 'Основная навигация' });
    await toggle.click();
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link').nth(0)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeFocused();
    await toggle.click();
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeFocused();
    await nav.getByRole('link', { name: 'О платформе' }).click();
    await expect(nav).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
}
