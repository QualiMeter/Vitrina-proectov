import { apiRequest, refreshCsrfToken } from './client';

export type GlobalRole = 'STUDENT' | 'UNIVERSITY_STAFF' | 'PLATFORM_ADMIN';
export type AvailableArea = 'student' | 'company' | 'university' | 'mentor' | 'admin';
export type CompanyMembershipRole = 'OWNER' | 'MEMBER';

export interface CompanyMembership {
  companyId: string;
  companyName: string;
  membershipRole: CompanyMembershipRole;
}

/** AuthSessionResponse from docs/api/openapi.yaml. */
export interface AuthSession {
  user: {
    id: string;
    email: string;
    fullName: string;
    nickname?: string;
    globalRoles: GlobalRole[];
    availableAreas: AvailableArea[];
    permissions: string[];
    companyMemberships: CompanyMembership[];
  };
  session: { expiresAt: string };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  fullName: string;
  nickname: string;
  privacyAccepted: true;
  privacyPolicyVersion: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface InvitationPreview {
  companyId: string;
  companyName: string;
  role: 'OWNER' | 'MEMBER';
  expiresAt: string;
  maskedEmail: string;
}

export type AcceptInvitationPayload =
  | { mode: 'existing'; token: string }
  | { mode: 'new'; token: string; fullName: string; password: string; privacyAccepted: true; privacyPolicyVersion: string };

/** The version must match the published privacy policy accepted by the user. */
export const PRIVACY_POLICY_VERSION = 'v1';

/** Fetch the request token used by apiRequest for all state-changing methods. */
export async function fetchCsrfToken(): Promise<string> {
  const { csrfToken } = await apiRequest<{ csrfToken: string }>('/api/v1/auth/csrf');
  return csrfToken;
}

async function rotateCsrfToken(): Promise<void> {
  try {
    await refreshCsrfToken();
  } catch {
    // The next mutation retries the fetch; do not report a completed auth action as failed.
  }
}

/** Sign in and rotate the anonymous CSRF token after the session changes. */
export async function login(payload: LoginPayload): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await rotateCsrfToken();
  return session;
}

export async function register(payload: RegisterPayload): Promise<void> {
  await apiRequest('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(token: string): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/api/v1/auth/email-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  await rotateCsrfToken();
  return session;
}

export async function resendVerification(email: string): Promise<void> {
  await apiRequest('/api/v1/auth/email-verification/resend', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function forgotPassword(email: string): Promise<void> {
  await apiRequest('/api/v1/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await apiRequest('/api/v1/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function me(): Promise<AuthSession | null> {
  try {
    return await apiRequest<AuthSession>('/api/v1/auth/me');
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'status' in error
      && (error as { status?: number }).status === 401) return null;
    throw error;
  }
}

export async function logout(): Promise<void> {
  await apiRequest('/api/v1/auth/logout', { method: 'POST' });
  await rotateCsrfToken();
}

export async function previewInvitation(token: string): Promise<InvitationPreview> {
  return apiRequest<InvitationPreview>('/api/v1/company-invitations/preview', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function acceptInvitation(payload: AcceptInvitationPayload): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/api/v1/company-invitations/accept', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await rotateCsrfToken();
  return session;
}
