import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { expect, it } from 'vitest';
import { CompanyCaseEditor, CompanyCasesPage, CompanyDemoLayout } from './CompanyCasesPage';

it('requires explicit demo, saves and reopens an edited draft through routes', async () => {
  const router = createMemoryRouter([{ path: '/company/cases', element: <CompanyDemoLayout />, children: [
    { index: true, element: <CompanyCasesPage /> },
    { path: 'new', element: <CompanyCaseEditor /> },
    { path: ':caseId/edit', element: <CompanyCaseEditor /> }
  ] }], { initialEntries: ['/company/cases/new'] });
  render(<RouterProvider router={router} />);
  expect(screen.queryByLabelText('Название')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Открыть демонстрацию' }));
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Сохранённый кейс' } });
  const format = screen.getByLabelText('Формат', { exact: true });
  expect(format).toHaveAccessibleName('Формат');
  fireEvent.change(format, { target: { value: 'BOTH' } });
  const admission = screen.getByLabelText('Приём участников', { exact: true });
  expect(admission).toHaveAccessibleName('Приём участников');
  fireEvent.change(admission, { target: { value: 'SELECTIVE' } });
  fireEvent.change(screen.getByLabelText('Лимит команд'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Лимит соло'), { target: { value: '2' } });
  fireEvent.click(screen.getByLabelText('Веб-разработка'));
  fireEvent.click(screen.getByLabelText('Анализ данных'));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить демочерновик' }));
  await waitFor(() => expect(router.state.location.pathname).toMatch(/\/cases\/[0-9a-f-]+\/edit$/));
  await waitFor(() => {
    expect(screen.getByLabelText('Название')).toHaveValue('Сохранённый кейс');
    expect(screen.getByLabelText('Лимит команд')).toHaveValue(0);
    expect(screen.getByLabelText('Формат', { exact: true })).toHaveValue('BOTH');
    expect(screen.getByLabelText('Приём участников', { exact: true })).toHaveValue('SELECTIVE');
    expect(screen.getByLabelText('Веб-разработка')).toBeChecked();
    expect(screen.getByLabelText('Анализ данных')).toBeChecked();
  });
  await act(async () => { await router.navigate('/company/cases'); });
  expect(await screen.findByRole('heading', { name: 'Сохранённый кейс' })).toBeVisible();
});

function renderEditor() {
  const router = createMemoryRouter([{ path: '/company/cases', element: <CompanyDemoLayout />, children: [
    { index: true, element: <CompanyCasesPage /> }, { path: 'new', element: <CompanyCaseEditor /> },
    { path: ':caseId/edit', element: <CompanyCaseEditor /> }
  ] }], { initialEntries: ['/company/cases/a2000000-0000-4000-8000-000000000001/edit'] });
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть демонстрацию' }));
  return router;
}

it('keeps input after a failed save and focuses the accessible error', async () => {
  renderEditor();
  fireEvent.change(screen.getByLabelText('Сценарий проверки'), { target: { value: 'save-error' } });
  const input = await screen.findByLabelText('Название');
  fireEvent.change(input, { target: { value: 'Моя правка' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить демочерновик' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Не удалось сохранить');
  await waitFor(() => expect(alert).toHaveFocus());
  expect(screen.getByLabelText('Название')).toHaveValue('Моя правка');
});

it('keeps a conflicting draft until the user explicitly reloads the latest version', async () => {
  renderEditor();
  fireEvent.change(screen.getByLabelText('Сценарий проверки'), { target: { value: 'conflict' } });
  fireEvent.change(await screen.findByLabelText('Название'), { target: { value: 'Моя правка' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить демочерновик' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('409');
  expect(screen.getByLabelText('Название')).toHaveValue('Моя правка');
  fireEvent.click(screen.getByRole('button', { name: 'Загрузить актуальную версию' }));
  await waitFor(() => expect(screen.getByLabelText('Название')).toHaveValue('Новый сервис компании'));
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Согласованная правка' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить демочерновик' }));
  expect(await screen.findByText(/Демонстрационный черновик сохранён/)).toBeVisible();
});

it('blocks writes on a direct editor URL when only viewing is allowed', async () => {
  renderEditor();
  fireEvent.change(screen.getByLabelText('Сценарий проверки'), { target: { value: 'read-only' } });
  expect(await screen.findByLabelText('Название')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Сохранить демочерновик' })).toBeDisabled();
});
