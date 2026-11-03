import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const draftId = 'a2000000-0000-4000-8000-000000000001';
const registrationId = 'a2000000-0000-4000-8000-000000000004';
const openAdmissionId = 'a2000000-0000-4000-8000-000000000006';
const screenshots = fileURLToPath(new URL('../../docs/screenshots/company-day3/', import.meta.url));
async function enter(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
}
async function createStage(page: Page, title = 'Прототип') {
  await page.getByRole('button', { name: 'Добавить этап', exact: true }).click();
  await page.getByLabel('Название этапа', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Сохранить этап', exact: true }).click();
  await expect(page.getByRole('heading', { name: `2. ${title}`, exact: true })).toBeVisible();
}
test('explicit company demo works alongside the real public login', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/company/cases');
  await expect(page).toHaveURL(/\/company\/cases$/);
  await page.getByRole('button', { name: 'Открыть демонстрацию' }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
  await page.getByRole('article').filter({ hasText: 'Новый сервис компании' }).getByRole('link', { name: 'Управление кейсом' }).click();
  await expect(page.getByRole('heading', { name: 'Набор и запуск' })).toBeVisible();
});

test('stage and checkpoint CRUD, ordering, selection limits and private instructions', async ({ page }) => {
  await enter(page, `/company/cases/${draftId}/stages`);
  await createStage(page);
  let card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '2. Прототип', exact: true }) });
  await card.getByRole('button', { name: 'Изменить этап', exact: true }).click();
  await page.getByLabel('Порядок этапа', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Сохранить этап', exact: true }).click();
  await expect(page.getByRole('heading', { name: '3. Прототип', exact: true })).toBeVisible();
  card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '3. Прототип', exact: true }) });
  await card.getByRole('button', { name: 'Добавить контрольную точку' }).click();
  await page.getByLabel('Название контрольной точки', { exact: true }).fill('Отбор прототипов');
  await page.getByLabel('Вид контрольной точки', { exact: true }).selectOption('SELECTION');
  await page.getByLabel('Общий срок контрольной точки', { exact: true }).fill('2027-01-10T15:00');
  await page.getByLabel('Проходящих команд', { exact: true }).fill('2');
  await page.getByLabel('Проходящих соло-участников', { exact: true }).fill('0');
  await page.getByLabel('Закрытые инструкции', { exact: true }).fill('Приватная инструкция прототипа');
  await page.getByRole('button', { name: 'Сохранить контрольную точку', exact: true }).click();
  const point = page.getByRole('region', { name: 'Контрольная точка Отбор прототипов' });
  await expect(point).toContainText('Проходящих команд: 2; соло-участников: 0');
  await expect(card.getByRole('button', { name: 'Удалить этап', exact: true })).toBeDisabled();
  await point.getByRole('button', { name: 'Изменить точку' }).click();
  await page.getByLabel('Название контрольной точки', { exact: true }).fill('Отбор MVP');
  await page.getByRole('button', { name: 'Сохранить контрольную точку', exact: true }).click();
  await card.getByRole('button', { name: 'Удалить точку', exact: true }).click();
  let modal = page.getByRole('dialog', { name: 'Удалить контрольную точку?' });
  await modal.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(card.getByRole('heading', { name: 'Отбор MVP · Отборочная' })).toBeVisible();
  await card.getByRole('button', { name: 'Удалить точку', exact: true }).click();
  modal = page.getByRole('dialog', { name: 'Удалить контрольную точку?' });
  await modal.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Удалить этап', exact: true })).toBeEnabled();
  await card.getByRole('button', { name: 'Удалить этап', exact: true }).click();
  await page.getByRole('dialog', { name: 'Удалить этап?' }).getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(page.getByRole('heading', { name: '3. Прототип', exact: true })).toHaveCount(0);
  await page.goto('/cases/a1000000-0000-4000-8000-000000000001');
  await expect(page.getByText('Приватная инструкция прототипа', { exact: true })).toHaveCount(0);
});

test('company application filters, pagination, confirmed participants and admission', async ({ page }) => {
  await enter(page, `/company/cases/${registrationId}/applications`);
  await expect(page.getByRole('link', { name: 'Открыть заявку' })).toHaveCount(3);
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.getByText(/Страница 2 из 2/)).toBeVisible();
  await page.getByLabel('Статус заявки', { exact: true }).selectOption('SUBMITTED');
  await page.getByLabel('Формат заявки', { exact: true }).selectOption('SOLO');
  await expect(page.getByRole('link', { name: 'Открыть заявку' })).toHaveCount(2);
  await page.getByRole('link', { name: 'Открыть заявку' }).first().click();
  await expect(page.getByRole('heading', { name: 'Подтверждённый состав при подаче' })).toBeVisible();
  await expect(page.getByText(/Демо-участник/)).toBeVisible();
  await page.getByRole('button', { name: 'Принять', exact: true }).click();
  let modal = page.getByRole('dialog', { name: 'Принять заявку?' });
  await modal.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByText(/Статус заявки: На рассмотрении/)).toBeVisible();
  await page.getByRole('button', { name: 'Принять', exact: true }).click();
  modal = page.getByRole('dialog', { name: 'Принять заявку?' });
  await modal.getByRole('button', { name: 'Подтвердить допуск', exact: true }).click();
  await expect(page.getByText(/Статус заявки: Допущена/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Принять', exact: true })).toHaveCount(0);
});

test('rejection requires a reason and open admission has no manual decision', async ({ page }) => {
  await enter(page, `/company/cases/${registrationId}/applications`);
  await page.getByRole('link', { name: 'Открыть заявку' }).first().click();
  await page.getByRole('button', { name: 'Отклонить', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Отклонить заявку?' });
  await modal.getByRole('button', { name: 'Подтвердить отклонение' }).click();
  await expect(modal).toBeVisible();
  await modal.getByLabel('Причина отклонения', { exact: true }).fill('Недостаточно опыта для требований кейса');
  await modal.getByRole('button', { name: 'Подтвердить отклонение' }).click();
  await expect(page.getByText(/Статус заявки: Отклонена/)).toBeVisible();
  await enter(page, `/company/cases/${openAdmissionId}/applications`);
  await expect(page.getByText(/Свободный набор: допуск выполняется автоматически/)).toBeVisible();
  await page.getByRole('link', { name: 'Открыть заявку' }).first().click();
  await expect(page.getByRole('heading', { name: 'Подтверждённый состав при подаче' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Принять', exact: true })).toHaveCount(0);
});

test('conflict and failed saving preserve a stage form; read-only and denied block management', async ({ page }) => {
  await enter(page, `/company/cases/${draftId}/stages`);
  await page.getByLabel('Сценарий проверки').selectOption('conflict');
  await page.getByRole('button', { name: 'Добавить этап', exact: true }).click();
  await page.getByLabel('Название этапа', { exact: true }).fill('Не терять ввод');
  await page.getByRole('button', { name: 'Сохранить этап', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Версия кейса изменилась');
  await expect(page.getByLabel('Название этапа', { exact: true })).toHaveValue('Не терять ввод');
  await page.getByRole('button', { name: 'Загрузить актуальные данные' }).click();
  await page.getByRole('button', { name: 'Сохранить этап', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2. Не терять ввод' })).toBeVisible();
  await page.getByLabel('Сценарий проверки').selectOption('save-error');
  await page.getByRole('button', { name: 'Добавить этап', exact: true }).click();
  await page.getByLabel('Название этапа', { exact: true }).fill('Сохранить позже');
  await page.getByRole('button', { name: 'Сохранить этап', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось выполнить действие');
  await expect(page.getByLabel('Название этапа', { exact: true })).toHaveValue('Сохранить позже');
  await page.getByLabel('Сценарий проверки').selectOption('read-only');
  await expect(page.getByText(/Изменение структуры недоступно/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить этап', exact: true })).toHaveCount(0);
  await page.getByLabel('Сценарий проверки').selectOption('denied');
  await expect(page.getByRole('heading', { name: 'Доступ запрещён' })).toBeVisible();
});

test('closing and starting are separate confirmed state changes', async ({ page }) => {
  await enter(page, `/company/cases/${registrationId}/manage`);
  await expect(page.getByRole('button', { name: 'Запустить кейс', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Закрыть набор', exact: true }).click();
  await page.getByRole('dialog', { name: 'Закрыть набор?' }).getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await page.getByRole('button', { name: 'Запустить кейс', exact: true }).click();
  await page.getByRole('dialog', { name: 'Запустить кейс?' }).getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(page.getByText(/Статус: В работе/)).toBeVisible();
});

for (const width of [320, 375, 400, 1280]) {
  test(`day three stages and applications fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    for (const [name, path] of [
      ['stages', `/company/cases/${draftId}/stages`],
      ['applications', `/company/cases/${registrationId}/applications`]
    ]) {
      await enter(page, path);
      if (name === 'stages') await expect(page.getByRole('heading', { name: '1. Финальная сдача' })).toBeVisible();
      else await expect(page.getByRole('link', { name: 'Открыть заявку' })).toHaveCount(3);
      const widths = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
      expect(widths.content).toBeLessThanOrEqual(widths.viewport);
      if (width === 375 || width === 1280) {
        await mkdir(screenshots, { recursive: true });
        await page.screenshot({ path: `${screenshots}/${name}-${width}.png`, fullPage: true });
      }
    }
  });
}
