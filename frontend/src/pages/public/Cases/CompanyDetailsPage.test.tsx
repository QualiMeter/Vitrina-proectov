import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CompanyDetailsPage } from './CompanyDetailsPage';

describe('public company details', () => {
  it('shows public description and the company’s public cases without private contact fields', async () => {
    render(
      <MemoryRouter initialEntries={['/companies/c1000000-0000-4000-8000-000000000001']}>
        <Routes><Route path="/companies/:companyId" element={<CompanyDetailsPage />} /></Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Лаборатория цифровых решений' })).toBeInTheDocument();
    expect(screen.getByText(/развивает цифровые решения/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сервис мониторинга городской среды' })).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/телефон|внутренняя заметка/i)).not.toBeInTheDocument();
  });

  it('shows a not-found state for an unknown company', async () => {
    render(
      <MemoryRouter initialEntries={['/companies/unknown']}>
        <Routes><Route path="/companies/:companyId" element={<CompanyDetailsPage />} /></Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Компания не найдена' })).toBeInTheDocument();
  });

  it('shows loading failure and retries the public profile request', async () => {
    const companyId = 'c1000000-0000-4000-8000-000000000001';
    const loadCompany = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ company: { id: companyId, name: 'Публичная компания', description: 'Описание', directionIds: [] }, cases: [] });
    render(
      <MemoryRouter initialEntries={[`/companies/${companyId}`]}>
        <Routes><Route path="/companies/:companyId" element={<CompanyDetailsPage loadCompany={loadCompany} />} /></Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Не удалось загрузить профиль компании' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Публичная компания' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Опубликованных кейсов пока нет' })).toBeInTheDocument();
    await waitFor(() => expect(loadCompany).toHaveBeenCalledTimes(2));
  });
});
