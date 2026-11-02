import { apiRequest } from './client';
import type { Permission, ObjectPermissions } from '../types/permissions';

export interface CompanyMembershipSummary {
  companyId: string;
  companyName: string;
  membershipRole: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  nickname: string | null;
  globalRoles: string[];
  availableAreas: string[];
  permissions: Permission[];
  companyMemberships: CompanyMembershipSummary[];
}

export interface AuthSessionDetails {
  expiresAt: string;
}

export interface AuthSessionResponse {
  user: AuthUser;
  session: AuthSessionDetails;
}

export interface PendingVerificationResponse {
  userId: string;
  emailConfirmationRequired: boolean;
}

export interface RegisterStudentRequest {
  email: string;
  password: string;
  fullName: string;
  nickname: string;
  privacyAccepted: true;
  privacyPolicyVersion: string;
}

export interface ResourceAccess {
  resourceId: string;
  actions: ObjectPermissions;
}

interface CsrfTokenResponse {
  csrfToken: string;
}

async function postWithCsrf<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const csrf = await apiRequest<CsrfTokenResponse>('/api/v1/auth/csrf');

  return apiRequest<TResponse>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf.csrfToken,
    },
    body: JSON.stringify(body),
  });
}

export function register(request: RegisterStudentRequest): Promise<PendingVerificationResponse> {
  return postWithCsrf('/api/v1/auth/register', request);
}

export function login(email: string, password: string): Promise<AuthSessionResponse> {
  return postWithCsrf('/api/v1/auth/login', { email, password });
}

export function getCurrentSession(): Promise<AuthSessionResponse> {
  return apiRequest<AuthSessionResponse>('/api/v1/auth/me');
}

export function confirmEmail(token: string): Promise<AuthSessionResponse> {
  return postWithCsrf('/api/v1/auth/email-verification/confirm', { token });
}

export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return postWithCsrf('/api/v1/auth/password/forgot', { email });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return postWithCsrf('/api/v1/auth/password/reset', { token, newPassword });
}

export function logout(): Promise<void> {
  return postWithCsrf('/api/v1/auth/logout', {});
}
