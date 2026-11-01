import { expect, test } from '@playwright/test';

for (const width of [320, 375, 400, 1280]) {
  test(`home page has no horizontal overflow at ${width}px with a vertical scrollbar`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Идеи встречаются/ })).toBeVisible();
    await page.evaluate(() => { document.body.style.minHeight = '200vh'; });

    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    }));
    expect(widths.document, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(widths.viewport);
  });
}
