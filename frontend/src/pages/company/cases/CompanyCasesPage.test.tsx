import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  fireEvent.change(screen.getByLabelText('Лимит команд'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Лимит соло'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить демочерновик' }));
  await waitFor(() => expect(router.state.location.pathname).toMatch(/\/cases\/[0-9a-f-]+\/edit$/));
  await waitFor(() => expect(screen.getByLabelText('Название')).toHaveValue('Сохранённый кейс'));
  expect(screen.getByLabelText('Лимит команд')).toHaveValue(0);
  fireEvent.click(screen.getByRole('link', { name: /Мои кейсы/ }));
  expect(await screen.findByRole('heading', { name: 'Сохранённый кейс' })).toBeVisible();
});
