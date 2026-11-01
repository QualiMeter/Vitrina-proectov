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
  await page.getByRole('button', { name: 'Сохранить демочерновик' }).click();
  await expect(page).toHaveURL(/\/company\/cases\/[0-9a-f-]+\/edit$/);
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Тестовый черновик');
  await page.getByRole('link', { name: /Мои кейсы/ }).click();
  const card = page.getByRole('article').filter({ hasText: 'Тестовый черновик' });
  await card.getByRole('link', { name: 'Редактировать' }).click();
  await expect(page.getByLabel('Лимит команд', { exact: true })).toHaveValue('0');
  await expect(page.getByLabel('Лимит соло', { exact: true })).toHaveValue('3');
  await page.reload();
  await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await expect(page.getByRole('heading', { name: 'Черновик недоступен' })).toBeVisible();
});

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
