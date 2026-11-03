import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { CaseParticipationConditions } from './CaseParticipationConditions';

it('distinguishes zero, unlimited and missing public quotas without exposing private data', () => {
  render(<CaseParticipationConditions item={{ participationFormat: 'BOTH', maxAdmittedTeams: 0, maxAdmittedSolo: null }} registrationOpen />);
  expect(screen.getByText('0')).toBeVisible();
  expect(screen.getByText('Без ограничения')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Войти для подачи заявки' })).toBeDisabled();
});

it('links guests to FE-C only when the shared login route is available', () => {
  render(<MemoryRouter><CaseParticipationConditions item={{ participationFormat: 'SOLO' }} registrationOpen loginAvailable /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Войти для подачи заявки' })).toHaveAttribute('href', '/login');
  expect(screen.queryByText('Команды')).not.toBeInTheDocument();
  expect(screen.getByText('Не указано')).toBeVisible();
});
