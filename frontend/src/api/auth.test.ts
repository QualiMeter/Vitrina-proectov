import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from './client';
import {
  acceptInvitation,
  previewInvitation,
  forgotPassword,
  login,
  me,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
  logout,
  type AuthSession,
} from './auth';

const session: AuthSession = {
  user: {
    id: 'user-1',
    email: 'student@example.com',
    fullName: 'Иван Иванов',
    nickname: 'ivan',
    globalRoles: ['STUDENT'],
    availableAreas: ['student'],
    permissions: [],
    companyMemberships: [],
  },
  session: { expiresAt: '2026-11-02T00:00:00Z' },
};

describe('auth API contract', () => {
  const requests: { url: string; init: RequestInit }[] = [];

  beforeEach(() => {
    requests.length = 0;
    clearCsrfToken();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith('/api/v1/auth/csrf')) {
        return new Response(JSON.stringify({ csrfToken: `csrf-token-${requests.length}` }), { status: 200 });
      }
      if (url.endsWith('/api/v1/auth/register')) {
        return new Response(JSON.stringify({
          nextAction: 'VERIFY_EMAIL',
          message: 'Проверьте почту для подтверждения регистрации.',
        }), { status: 202 });
      }
      if (url.endsWith('/api/v1/auth/login') || url.endsWith('/api/v1/auth/email-verification/confirm')
        || url.endsWith('/api/v1/company-invitations/accept')) {
        return new Response(JSON.stringify(session), { status: 200 });
      }
      if (url.endsWith('/api/v1/company-invitations/preview')) return new Response(JSON.stringify({ companyId: 'company-1', companyName: 'ООО Пример', role: 'MEMBER', expiresAt: '2026-12-01T00:00:00Z', maskedEmail: 's***@example.com' }), { status: 200 });
      if (url.endsWith('/api/v1/auth/me')) return new Response(JSON.stringify(session), { status: 200 });
      return new Response(null, { status: 204 });
    }));
  });

  function mutation(path: string) {
    const request = requests.find(item => item.url.endsWith(path) && item.init.method === 'POST');
    expect(request, `POST ${path} was sent`).toBeDefined();
    expect(new Headers(request!.init.headers).get('X-CSRF-Token')).toMatch(/^csrf-token-/);
    if (request!.init.body) expect(new Headers(request!.init.headers).get('Content-Type')).toBe('application/json');
    return request!;
  }

  it('uses the OpenAPI paths, JSON DTOs, and CSRF header for every auth mutation', async () => {
    const pending = await register({
      email: 'student@example.com', password: 'password123', fullName: 'Иван Иванов', nickname: 'ivan',
      privacyAccepted: true, privacyPolicyVersion: 'v1',
    });
    expect(pending).toEqual({
      nextAction: 'VERIFY_EMAIL',
      message: 'Проверьте почту для подтверждения регистрации.',
    });
    await verifyEmail('verification-token-1234567890');
    await resendVerification('student@example.com');
    await forgotPassword('student@example.com');
    await resetPassword({ token: 'reset-token-1234567890', newPassword: 'new-password-123' });
    await previewInvitation('invitation-token-1234567890');
    await acceptInvitation({ mode: 'existing', token: 'invitation-token-1234567890' });
    await acceptInvitation({ mode: 'new', token: 'invitation-token-1234567890', fullName: 'Иван Иванов', password: 'password1234', privacyAccepted: true, privacyPolicyVersion: 'v1' });
    await logout();

    expect(requests[0].url).toMatch(/\/api\/v1\/auth\/csrf$/);
    expect(JSON.parse(mutation('/api/v1/auth/register').init.body as string)).toEqual({
      email: 'student@example.com', password: 'password123', fullName: 'Иван Иванов', nickname: 'ivan',
      privacyAccepted: true, privacyPolicyVersion: 'v1',
    });
    expect(mutation('/api/v1/auth/email-verification/confirm').init.body).toBe(JSON.stringify({ token: 'verification-token-1234567890' }));
    expect(mutation('/api/v1/auth/email-verification/resend').init.body).toBe(JSON.stringify({ email: 'student@example.com' }));
    expect(mutation('/api/v1/auth/password/forgot').init.body).toBe(JSON.stringify({ email: 'student@example.com' }));
    expect(mutation('/api/v1/auth/password/reset').init.body).toBe(JSON.stringify({ token: 'reset-token-1234567890', newPassword: 'new-password-123' }));
    expect(mutation('/api/v1/company-invitations/preview').init.body).toBe(JSON.stringify({ token: 'invitation-token-1234567890' }));
    expect(requests.filter(request => request.url.endsWith('/api/v1/company-invitations/accept')).map(request => JSON.parse(request.init.body as string))).toEqual([
      { mode: 'existing', token: 'invitation-token-1234567890' },
      { mode: 'new', token: 'invitation-token-1234567890', fullName: 'Иван Иванов', password: 'password1234', privacyAccepted: true, privacyPolicyVersion: 'v1' },
    ]);
    mutation('/api/v1/auth/logout');
    expect(requests.some(request => request.url.includes('/accept/invitation-token'))).toBe(false);
  });

  it('uses the nested AuthSessionResponse and refreshes CSRF after login', async () => {
    const result = await login({ email: 'student@example.com', password: 'password123' });
    expect(result).toEqual(session);
    expect(mutation('/api/v1/auth/login').init.body).toBe(JSON.stringify({ email: 'student@example.com', password: 'password123' }));
    expect(requests.filter(request => request.url.endsWith('/api/v1/auth/csrf'))).toHaveLength(2);
    expect(await me()).toEqual(session);
  });
});
