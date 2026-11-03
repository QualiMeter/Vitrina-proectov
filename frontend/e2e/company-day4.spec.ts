import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const execution = '/company/cases/d4000000-0000-4000-8000-000000000001/workspace';
const evaluation = '/company/cases/d4000000-0000-4000-8000-000000000002/workspace';
async function enter(page: Page, path = execution) {
  await page.goto(path); await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await expect(page.getByRole('heading', { name: /городской сервис/ })).toBeVisible();
}
async function confirm(page: Page, title: string) {
  await page.getByRole('dialog', { name: title, exact: true }).getByRole('button', { name: 'Подтвердить', exact: true }).click();
}
test('selection enforces N and separate solo quota and requires irreversible confirmation', async ({ page }) => {
  await enter(page);
  await page.getByRole('checkbox', { name: 'Альфа', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Бета', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Гамма', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Соло 1', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Соло 2', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Завершить отбор', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click();
  await expect(page.getByRole('checkbox', { name: 'Альфа', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Завершить отбор', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Действие необратимо');
  await confirm(page, 'Завершить отбор?');
  await expect(page.getByRole('button', { name: 'Завершить отбор', exact: true })).toBeDisabled();
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Гамма', exact: true }) })).toContainText('Выбыла');
  await page.getByRole('button', { name: 'Завершить финальный приём', exact: true }).click();
  await confirm(page, 'Завершить финальный приём?');
  await expect(page.getByRole('button', { name: 'Начать оценивание', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Начать оценивание', exact: true }).click(); await confirm(page, 'Начать оценивание?');
  await page.getByLabel('Место — Альфа', { exact: true }).selectOption('1');
  await page.getByLabel('Место — Бета', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Сохранить распределение', exact: true }).click();
  await expect(page.getByText('1 место: Альфа, Бета', { exact: true })).toBeVisible();
});
test('exclusion requires a reason, cancellation keeps the team and confirmation stores reason', async ({ page }) => {
  await enter(page); await page.getByRole('button', { name: 'Исключить команду Альфа', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Подтвердить', exact: true })).toBeDisabled();
  await page.getByLabel('Причина исключения', { exact: true }).fill('  ');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Подтвердить', exact: true })).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click();
  await page.getByRole('button', { name: 'Исключить команду Альфа', exact: true }).click();
  await page.getByLabel('Причина исключения', { exact: true }).fill('Нарушены условия кейса');
  await confirm(page, 'Исключить команду Альфа?');
  await expect(page.getByText('Причина исключения: Нарушены условия кейса', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Исключить команду Альфа', exact: true })).toHaveCount(0);
});
test('versions retain server late flag, timestamps, links and downloadable demo attachment', async ({ page }) => {
  await enter(page); await expect(page.getByText('Просрочено', { exact: true })).toBeVisible();
  await page.getByLabel('Версия сдачи', { exact: true }).selectOption('1');
  await expect(page.getByText('В срок', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Репозиторий', exact: true })).toHaveAttribute('href', 'https://github.com/QualiMeter/Vitrina-proectov');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать Демо-описание.txt', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('Демо-описание.txt');
});
test('feedback supports no score and nonshared rules prevent duplicate places', async ({ page }) => {
  await enter(page, evaluation);
  await page.getByLabel('Комментарий компании — Альфа', { exact: true }).fill('Хороший прототип');
  await page.getByRole('button', { name: 'Сохранить отзыв — Альфа', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Отзыв для Альфа сохранён');
  await page.getByLabel('Оценка — Альфа', { exact: true }).fill('8.5');
  await page.getByRole('button', { name: 'Сохранить отзыв — Альфа', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Отзыв — Альфа', exact: true })).toContainText('Версия отзыва: 2');
  await page.getByLabel('Место — Альфа', { exact: true }).selectOption('1');
  await page.getByLabel('Место — Бета', { exact: true }).selectOption('1');
  await expect(page.getByRole('button', { name: 'Сохранить распределение', exact: true })).toBeDisabled();
  await page.getByLabel('Место — Бета', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Сохранить распределение', exact: true }).click();
  await expect(page.getByText('1 место: Альфа', { exact: true })).toBeVisible();
});
test('conflict preserves feedback; explicit refresh and read-only/denied modes respect boundaries', async ({ page }) => {
  await enter(page, evaluation); await page.getByLabel('Сценарий проверки').selectOption('conflict');
  await page.getByLabel('Комментарий компании — Альфа', { exact: true }).fill('Не потерять');
  await page.getByRole('button', { name: 'Сохранить отзыв — Альфа', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('409');
  await expect(page.getByLabel('Комментарий компании — Альфа', { exact: true })).toHaveValue('Не потерять');
  await page.getByRole('button', { name: 'Загрузить актуальные данные' }).click();
  await page.getByLabel('Сценарий проверки').selectOption('read-only');
  await expect(page.getByRole('button', { name: 'Сохранить отзыв — Альфа', exact: true })).toBeDisabled();
  await page.getByLabel('Сценарий проверки').selectOption('denied');
  await expect(page.getByRole('heading', { name: 'Доступ запрещён' })).toBeVisible();
  await expect(page.getByLabel('Комментарий компании — Альфа', { exact: true })).toHaveCount(0);
});
test('workspace handles empty participants and unknown case', async ({ page }) => {
  await enter(page); await page.getByLabel('Сценарий проверки').selectOption('empty');
  await expect(page.getByRole('heading', { name: 'Участников пока нет' })).toBeVisible();
  await page.goto('/company/cases/missing/workspace'); await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await expect(page.getByRole('heading', { name: 'Рабочее пространство недоступно' })).toBeVisible();
});
for (const width of [320, 375, 768, 1280]) test(`day four workspace and evaluation fit ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  for (const path of [execution, evaluation]) {
    await enter(page, path);
    await expect(page.getByLabel('Версия сдачи', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if ([375, 1280].includes(width)) {
      const dir = fileURLToPath(new URL('../../docs/screenshots/company-day4/', import.meta.url));
      await mkdir(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/${path === execution ? 'workspace' : 'evaluation'}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
  }
});
