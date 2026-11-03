import { expect, test } from '@playwright/test';

test('Golos Text loads locally without Google Fonts, including extended Cyrillic', async ({ page }) => {
  const remoteRequests: string[] = [];
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => {
    remoteRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/');
  const fonts = await page.evaluate(async () => {
    const results = [];
    for (const weight of [400, 500, 600, 700]) {
      const faces = await document.fonts.load(`${weight} 16px "Golos Text"`, 'Проект QualiMeter Ә Ł');
      results.push(faces.length > 0 && faces.every(face => face.status === 'loaded'));
    }
    return results;
  });
  expect(fonts).toEqual([true, true, true, true]);
  expect(remoteRequests).toEqual([]);
});
