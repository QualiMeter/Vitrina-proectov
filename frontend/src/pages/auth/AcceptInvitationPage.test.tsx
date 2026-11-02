import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '../../features/auth/context';
import { ApiError } from '../../api/client';
import { AcceptInvitationPage } from './AcceptInvitationPage';
import { takePendingInvitationToken } from '../../features/auth/pendingInvitation';

const api = vi.hoisted(() => ({ previewInvitation: vi.fn(), acceptInvitation: vi.fn() }));
vi.mock('../../api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/auth')>()),
  previewInvitation: api.previewInvitation,
  acceptInvitation: api.acceptInvitation,
}));

const invitePreview = {
  companyId: 'company-1', companyName: 'ООО Пример', role: 'MEMBER' as const,
  expiresAt: '2026-12-01T00:00:00Z', maskedEmail: 'i***@example.com',
};
const signedIn: AuthContextValue = {
  session: { user: { id: 'u1', email: 'i@example.com', fullName: 'Иван Иванов', globalRoles: ['STUDENT'], availableAreas: ['company'], permissions: [], companyMemberships: [] }, session: { expiresAt: '2026-12-01T00:00:00Z' } },
  isLoading: false, loadError: false, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn(), retrySession: vi.fn(), adoptSession: vi.fn(),
};
const guest: AuthContextValue = { ...signedIn, session: null, adoptSession: vi.fn() };

function open(context: AuthContextValue) {
  return render(<AuthContext.Provider value={context}><MemoryRouter initialEntries={['/accept-invitation?token=invitation-token-1234567890']}>
    <Routes><Route path="/accept-invitation" element={<AcceptInvitationPage />} /><Route path="/company" element={<p>Компания</p>} /><Route path="/login" element={<LoginLocation />} /></Routes>
  </MemoryRouter></AuthContext.Provider>);
}

function LoginLocation() {
  const location = useLocation();
  return <output data-testid="login-location">{location.pathname}{location.search}</output>;
}

describe('company invitation acceptance', () => {
  beforeEach(() => {
    sessionStorage.clear();
    takePendingInvitationToken();
    api.previewInvitation.mockReset().mockResolvedValue(invitePreview);
    api.acceptInvitation.mockReset().mockResolvedValue(signedIn.session);
  });

  it('previews and requires confirmation for an existing account', async () => {
    open(signedIn);
    expect(await screen.findByText('ООО Пример')).toBeInTheDocument();
    expect(api.previewInvitation).toHaveBeenCalledWith('invitation-token-1234567890');
    const acceptButton = screen.getByRole('button', { name: 'Подтвердить и принять приглашение' });
    fireEvent.click(acceptButton);
    fireEvent.click(acceptButton);
    await waitFor(() => expect(api.acceptInvitation).toHaveBeenCalledTimes(1));
    expect(api.acceptInvitation).toHaveBeenCalledWith({ mode: 'existing', token: 'invitation-token-1234567890' });
    expect(await screen.findByText('Компания')).toBeInTheDocument();
  });

  it('creates a new account only after required details and privacy consent', async () => {
    open(guest);
    await screen.findByText('ООО Пример');
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
    fireEvent.change(screen.getByLabelText('ФИО'), { target: { value: 'Иван Иванов' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'secure-password-123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить и принять приглашение' }));
    await waitFor(() => expect(api.acceptInvitation).toHaveBeenCalledWith({
      mode: 'new', token: 'invitation-token-1234567890', fullName: 'Иван Иванов', password: 'secure-password-123',
      privacyAccepted: true, privacyPolicyVersion: 'v1',
    }));
  });

  it('keeps the invitation token only for the explicit login round trip and removes it from the URL', async () => {
    open(guest);
    const login = await screen.findByRole('link', { name: 'войдите' });
    fireEvent.click(login);
    expect(sessionStorage.getItem('vitrina.pending-company-invitation')).toBeNull();
    expect(takePendingInvitationToken()).toBe('invitation-token-1234567890');
    expect(await screen.findByTestId('login-location')).toHaveTextContent('/login');
  });

  it.each([
    [400, 'Ссылка приглашения повреждена.'],
    [401, 'Войдите в аккаунт'],
    [403, 'предназначено для другого пользователя'],
    [404, 'истекло или уже использовано'],
    [409, 'Аккаунт уже существует'],
  ])('shows a safe message for invitation status %i', async (status, message) => {
    api.previewInvitation.mockRejectedValueOnce(new ApiError(status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'notFound' : status === 409 ? 'conflict' : 'unknown', status));
    open(guest);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
