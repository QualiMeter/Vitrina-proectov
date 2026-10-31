import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CasesPage } from './CasesPage';
import { mockPublicCases } from './mockCases';
import { publicCaseStatuses } from './types';
import { selectLocalPage } from './catalogue';

const emptyFilters = { search: '', directionId: '', technologyId: '', format: '' as const, status: '' as const, course: '', hasReward: false };
const renderPage = (loadCases?: () => Promise<typeof mockPublicCases>) => render(
  <MemoryRouter initialEntries={['/cases']}>
    <CasesPage loadCases={loadCases} />
  </MemoryRouter>
);

describe('local catalogue selection', () => {
  it('supports BOTH for solo and team filter choices', () => {
    expect(selectLocalPage(mockPublicCases, { ...emptyFilters, format: 'SOLO' }, 1, 20).filtered.map((item) => item.id))
      .toContain(mockPublicCases[1].id);
    expect(selectLocalPage(mockPublicCases, { ...emptyFilters, format: 'TEAM' }, 1, 20).filtered.map((item) => item.id))
      .toContain(mockPublicCases[1].id);
  });

  it('searches company, title, and reward terms, and returns an empty result', () => {
    expect(selectLocalPage(mockPublicCases, { ...emptyFilters, search: 'АльфаТех' }, 1, 20).filtered).toHaveLength(1);
    expect(selectLocalPage(mockPublicCases, { ...emptyFilters, search: 'нет такого кейса' }, 1, 20).filtered).toHaveLength(0);
  });

  it('applies direction, technology, status, course, and reward filters together', () => {
    const result = selectLocalPage(mockPublicCases, {
      ...emptyFilters,
      directionId: 'd1000000-0000-4000-8000-000000000002',
      technologyId: 'f1000000-0000-4000-8000-000000000002',
      status: 'REGISTRATION_OPEN',
      course: '3',
      hasReward: true
    }, 1, 20);
    expect(result.filtered.map((item) => item.id)).toEqual([mockPublicCases[0].id, mockPublicCases[5].id]);
  });

  it('uses UUID identifiers in API shaped fixtures', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const item of mockPublicCases) {
      expect(item.id).toMatch(uuid);
      expect(item.companyId).toMatch(uuid);
      expect(item.directionIds.every((id) => uuid.test(id))).toBe(true);
      expect(item.technologyIds.every((id) => uuid.test(id))).toBe(true);
    }
  });

  it('paginates the full fixture set locally and clamps an out-of-range page', () => {
    const first = selectLocalPage(mockPublicCases, emptyFilters, 1, 3);
    const second = selectLocalPage(mockPublicCases, emptyFilters, 2, 3);
    expect(first.filtered).toHaveLength(6);
    expect(first.items).toHaveLength(3);
    expect(first.pageCount).toBe(2);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect(selectLocalPage(mockPublicCases, emptyFilters, 9, 3).currentPage).toBe(2);
  });

  it('exposes only public statuses in the filter', () => {
    expect(publicCaseStatuses).not.toContain('DRAFT');
    expect(publicCaseStatuses).not.toContain('MODERATION');
    expect(publicCaseStatuses).not.toContain('REVISION');
    expect(publicCaseStatuses).not.toContain('REJECTED');
    expect(publicCaseStatuses).toContain('FINAL_CLOSED');
  });
});

describe('catalogue screen', () => {
  it('filters results and resets to the full list', async () => {
    renderPage();
    await screen.findByText('Найдено: 6');
    fireEvent.change(screen.getByLabelText('Поиск'), { target: { value: 'несуществующий кейс' } });
    await screen.findByText('Кейсы не найдены');
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    await screen.findByText('Найдено: 6');
  });

  it('returns to page one when a filter changes', async () => {
    renderPage();
    await screen.findByText('Найдено: 6');
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    expect(screen.getByText('Страница 2 из 2')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'REGISTRATION_OPEN' } });
    await waitFor(() => expect(screen.getByText('Страница 1 из 2')).toBeInTheDocument());
  });

  it('shows loading failure and retries through the injected loader', async () => {
    const loadCases = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(mockPublicCases);
    renderPage(loadCases);
    await screen.findByText('Не удалось загрузить кейсы');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(loadCases).toHaveBeenCalledTimes(2));
    await screen.findByText('Найдено: 6');
  });
});
