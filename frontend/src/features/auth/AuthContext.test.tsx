import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

const authApi = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../../api/auth', () => ({
  me: authApi.me,
  login: authApi.login,
  logout: authApi.logout,
}));

const currentSession = {
  user: {
    id: 'new-user',
    email: 'new@example.com',
    fullName: 'Новый пользователь',
    globalRoles: ['STUDENT'],
    availableAreas: ['student'],
    permissions: [],
    companyMemberships: [],
  },
  session: { expiresAt: '2026-12-01T00:00:00Z' },
};

const staleSession = {
  user: {
    id: 'stale-user',
    email: 'stale@example.com',
    fullName: 'Старая сессия',
    globalRoles: ['STUDENT'],
    availableAreas: ['student'],
    permissions: [],
    companyMemberships: [],
  },
  session: { expiresAt: '2026-11-01T00:00:00Z' },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <output data-testid="session">{auth.session?.user.email ?? 'guest'}</output>
      <output data-testid="loading">{String(auth.isLoading)}</output>
      <button type="button" onClick={() => void auth.login({ email: 'new@example.com', password: 'password123' })}>
        Login
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        Logout
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

describe('AuthProvider session synchronization', () => {
  beforeEach(() => {
    authApi.me.mockReset();
    authApi.login.mockReset();
    authApi.logout.mockReset();
  });

  it('does not let the initial /auth/me response overwrite a successful login', async () => {
    const initialRequest = deferred<typeof staleSession | null>();
    authApi.me.mockReturnValueOnce(initialRequest.promise);
    authApi.login.mockResolvedValueOnce(currentSession);

    renderProvider();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    });

    expect(screen.getByTestId('session')).toHaveTextContent('new@example.com');

    await act(async () => {
      initialRequest.resolve(staleSession);
      await initialRequest.promise;
    });

    expect(screen.getByTestId('session')).toHaveTextContent('new@example.com');
  });

  it('does not let the initial /auth/me response restore a session after logout', async () => {
    const initialRequest = deferred<typeof staleSession | null>();
    authApi.me.mockReturnValueOnce(initialRequest.promise);
    authApi.logout.mockResolvedValueOnce(undefined);

    renderProvider();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    });

    await act(async () => {
      initialRequest.resolve(staleSession);
      await initialRequest.promise;
    });

    expect(screen.getByTestId('session')).toHaveTextContent('guest');
  });

  it('clears the authenticated state immediately after a protected API session-expired event', async () => {
    authApi.me.mockResolvedValueOnce(currentSession);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('session')).toHaveTextContent('new@example.com');
    });

    act(() => {
      window.dispatchEvent(new Event('vitrina:session-expired'));
    });

    expect(screen.getByTestId('session')).toHaveTextContent('guest');
    expect(authApi.me).toHaveBeenCalledTimes(1);
  });
});
