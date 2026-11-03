import { beforeAll, afterAll, expect, it } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { CompanyCaseEditor, CompanyCasesPage, CompanyDemoLayout } from '../cases/CompanyCasesPage';
import { CompanyWorkflowPage } from './CompanyWorkflowPage';
import { registrationCaseId } from './mockWorkflow';

const draftId = 'a2000000-0000-4000-8000-000000000001';
const dialogDescriptors = ['showModal', 'close'].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)] as const);
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterAll(() => {
  for (const [name, descriptor] of dialogDescriptors) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
function setup(path: string) {
  const router = createMemoryRouter([
    { path: '/company/cases', element: <CompanyDemoLayout />, children: [
      { index: true, element: <CompanyCasesPage /> }, { path: ':caseId/edit', element: <CompanyCaseEditor /> },
      { path: ':caseId/manage', element: <CompanyWorkflowPage view="overview" /> },
      { path: ':caseId/stages', element: <CompanyWorkflowPage view="stages" /> },
      { path: ':caseId/applications', element: <CompanyWorkflowPage view="applications" /> },
      { path: ':caseId/applications/:applicationId', element: <CompanyWorkflowPage view="applications" /> }
    ] }
  ], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}
async function enterDemo() { fireEvent.click(screen.getByRole('button', { name: 'Открыть демонстрацию' })); }

it('requires explicit entry to the company demo without pretending to log in', async () => {
  setup('/company/cases');
  expect(screen.getByRole('heading', { name: 'Кабинет компании' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Мои кейсы' })).not.toBeInTheDocument();
  await enterDemo();
  expect(await screen.findByRole('heading', { name: 'Мои кейсы' })).toBeVisible();
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(6));
});

it('creates a stage and a selection checkpoint with independent team and solo limits', async () => {
  const { user } = setup(`/company/cases/${draftId}/stages`);
  await enterDemo();
  await user.click(await screen.findByRole('button', { name: 'Добавить этап' }));
  fireEvent.change(screen.getByLabelText('Название этапа'), { target: { value: 'Прототип' } });
  await user.click(screen.getByRole('button', { name: 'Сохранить этап' }));
  const heading = await screen.findByRole('heading', { name: '2. Прототип' });
  const card = within(heading.closest('article')!);
  await user.click(card.getByRole('button', { name: 'Добавить контрольную точку' }));
  fireEvent.change(screen.getByLabelText('Название контрольной точки'), { target: { value: 'Отбор прототипов' } });
  fireEvent.change(screen.getByLabelText('Вид контрольной точки', { exact: true }), { target: { value: 'SELECTION' } });
  fireEvent.change(screen.getByLabelText('Общий срок контрольной точки'), { target: { value: '2027-01-10T15:00' } });
  fireEvent.change(screen.getByLabelText('Проходящих команд'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Проходящих соло-участников'), { target: { value: '0' } });
  await user.click(screen.getByRole('button', { name: 'Сохранить контрольную точку' }));
  expect(await screen.findByRole('heading', { name: 'Отбор прототипов · Отборочная' })).toBeVisible();
  expect(screen.getByText(/Проходящих команд: 2; соло-участников: 0/)).toBeVisible();
  expect(screen.getByLabelText('Формат защиты')).toBeDisabled();
});

it('preserves stage form input after a conflict and supports an explicit refresh and retry', async () => {
  const { user } = setup(`/company/cases/${draftId}/stages`);
  await enterDemo();
  fireEvent.change(screen.getByLabelText('Сценарий проверки'), { target: { value: 'conflict' } });
  await user.click(await screen.findByRole('button', { name: 'Добавить этап' }));
  fireEvent.change(screen.getByLabelText('Название этапа'), { target: { value: 'Без потери ввода' } });
  await user.click(screen.getByRole('button', { name: 'Сохранить этап' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Версия кейса изменилась');
  expect(screen.getByLabelText('Название этапа')).toHaveValue('Без потери ввода');
  await user.click(screen.getByRole('button', { name: 'Загрузить актуальные данные' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить этап' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Сохранить этап' }));
  expect(await screen.findByRole('heading', { name: '2. Без потери ввода' })).toBeVisible();
});

it('shows participants and admits a selective application only after confirmation', async () => {
  const { user } = setup(`/company/cases/${registrationCaseId}/applications`);
  await enterDemo();
  await screen.findByRole('heading', { name: 'Заявки на кейс' });
  fireEvent.change(screen.getByLabelText('Статус заявки', { exact: true }), { target: { value: 'SUBMITTED' } });
  fireEvent.change(screen.getByLabelText('Формат заявки', { exact: true }), { target: { value: 'SOLO' } });
  await waitFor(() => expect(screen.getAllByRole('link', { name: 'Открыть заявку' })).toHaveLength(2));
  await user.click(screen.getAllByRole('link', { name: 'Открыть заявку' })[0]);
  await user.click(await screen.findByRole('button', { name: 'Принять' }));
  const modal = screen.getByRole('dialog', { name: 'Принять заявку?' });
  expect(within(modal).getByText('Будет занято одно соло-место.')).toBeVisible();
  await user.click(within(modal).getByRole('button', { name: 'Подтвердить допуск' }));
  expect(await screen.findByText(/Статус заявки: Допущена/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Принять' })).not.toBeInTheDocument();
});

it('closes registration and starts execution through separate confirmations', async () => {
  const { user } = setup(`/company/cases/${registrationCaseId}/manage`);
  await enterDemo();
  await user.click(await screen.findByRole('button', { name: 'Закрыть набор' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Закрыть набор?' })).getByRole('button', { name: 'Отмена' }));
  expect(screen.getByRole('button', { name: 'Закрыть набор' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Закрыть набор' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Закрыть набор?' })).getByRole('button', { name: 'Подтвердить' }));
  await user.click(await screen.findByRole('button', { name: 'Запустить кейс' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Запустить кейс?' })).getByRole('button', { name: 'Подтвердить' }));
  expect(await screen.findByText(/Статус: В работе/)).toBeVisible();
});

it('protects a direct stage editor URL in read-only mode', async () => {
  setup(`/company/cases/${draftId}/stages`); await enterDemo();
  fireEvent.change(screen.getByLabelText('Сценарий проверки'), { target: { value: 'read-only' } });
  expect(await screen.findByText(/Изменение структуры недоступно/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Добавить этап' })).not.toBeInTheDocument();
});
