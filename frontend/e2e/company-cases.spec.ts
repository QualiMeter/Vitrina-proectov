import { expect, test } from '@playwright/test';

test('explicit demo creates and reopens a draft; reload does not imply server persistence', async ({ page }) => {
  await page.goto('/company/cases');
  await expect(page.getByRole('heading', { name: 'Мои кейсы' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await page.getByRole('link', { name: 'Создать кейс' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Тестовый черновик');
  await page.getByLabel('Формат', { exact: true }).selectOption('BOTH');
  await page.getByLabel('Лимит команд', { exact: true }).fill('0');
  await page.getByLabel('Лимит соло', { exact: true }).fill('3');
  await page.getByLabel('Веб-разработка', { exact: true }).check();
  await page.getByLabel('Анализ данных', { exact: true }).check();
  await page.getByRole('button', { name: 'Сохранить демочерновик' }).click();
  await expect(page).toHaveURL(/\/company\/cases\/[0-9a-f-]+\/edit$/);
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Тестовый черновик');
  await page.getByRole('link', { name: /Мои кейсы/ }).click();
  const card = page.getByRole('article').filter({ hasText: 'Тестовый черновик' });
  await card.getByRole('link', { name: 'Редактировать' }).click();
  await expect(page.getByLabel('Лимит команд', { exact: true })).toHaveValue('0');
  await expect(page.getByLabel('Лимит соло', { exact: true })).toHaveValue('3');
  await expect(page.getByLabel('Веб-разработка', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Анализ данных', { exact: true })).toBeChecked();
  await page.reload();
  await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await expect(page.getByRole('heading', { name: 'Черновик недоступен' })).toBeVisible();
});

test('company object permissions hide actions and prevent editing by a direct URL', async ({ page }) => {
  await page.goto('/company/cases');
  await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await page.getByLabel('Сценарий проверки').selectOption('read-only');
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Создать кейс' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Редактировать' })).toHaveCount(0);
  await page.goto('/company/cases/a2000000-0000-4000-8000-000000000003/edit');
  await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await expect(page.getByLabel('Название', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Сохранить демочерновик' })).toBeDisabled();
});

test('failed save preserves input and conflict requires explicit reload', async ({ page }) => {
  await page.goto('/company/cases/a2000000-0000-4000-8000-000000000001/edit');
  await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await page.getByLabel('Сценарий проверки').selectOption('save-error');
  const title = page.getByLabel('Название', { exact: true });
  await expect(title).toHaveValue('Новый сервис компании');
  await title.fill('Моя правка');
  await page.getByRole('button', { name: 'Сохранить демочерновик' }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(title).toHaveValue('Моя правка');
  await page.getByLabel('Сценарий проверки').selectOption('conflict');
  await expect(title).toHaveValue('Новый сервис компании');
  await title.fill('Правка после конфликта');
  await page.getByRole('button', { name: 'Сохранить демочерновик' }).click();
  await expect(page.getByRole('alert')).toContainText('409');
  await expect(title).toHaveValue('Правка после конфликта');
  await page.getByRole('button', { name: 'Загрузить актуальную версию' }).click();
  await expect(title).toHaveValue('Новый сервис компании');
});

for (const width of [320, 375, 400, 1280]) {
  test(`company editor fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/company/cases/new');
    await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
    await expect(page.getByLabel('Название', { exact: true })).toBeVisible();
    const widths = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(widths.actual).toBeLessThanOrEqual(widths.viewport);
  });
}

test('demo empty, error and denied states', async ({ page }) => {
  await page.goto('/company/cases');
  await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await page.getByLabel('Сценарий проверки').selectOption('empty');
  await expect(page.getByRole('heading', { name: 'Кейсов нет' })).toBeVisible();
  await page.getByLabel('Сценарий проверки').selectOption('error');
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить кейсы' })).toBeVisible();
  await page.getByLabel('Сценарий проверки').selectOption('denied');
  await expect(page.getByRole('heading', { name: 'Доступ запрещён' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
});
