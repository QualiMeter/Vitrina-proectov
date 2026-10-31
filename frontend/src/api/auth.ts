import { apiRequest } from './client';
import type { Permission, ObjectPermissions } from '../types/permissions';

/** Shape to adapt when the identity contract is published. No auth request is made yet. */
export interface AuthSession {
  userId: string;
  displayName: string;
  email: string;
  roles: string[];
  permissions: readonly Permission[];
}

export interface ResourceAccess { resourceId: string; actions: ObjectPermissions; }

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  consentPd: boolean;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

/** Запрос CSRF-токена перед любым изменяющим запросом. */
export async function fetchCsrfToken(): Promise<string> {
  const { token } = await apiRequest<{ token: string }>('/api/auth/csrf');
  return token;
}

/** Вход. Установка HttpOnly cookie на стороне сервера. */
export async function login(payload: LoginPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** Регистрация студента. */
export async function register(payload: RegisterPayload): Promise<void> {
  await apiRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** Подтверждение email по токену из письма. */
export async function verifyEmail(token: string): Promise<void> {
  await apiRequest('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

/** Повторная отправка письма подтверждения. */
export async function resendVerification(email: string): Promise<void> {
  await apiRequest('/api/auth/respond-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/** Запрос сброса пароля. */
export async function forgotPassword(email: string): Promise<void> {
  await apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/** Сброс пароля по одноразовому токену. */
export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await apiRequest('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** Получение текущей сессии. */
export async function me(): Promise<AuthSession | null> {
  try {
    return await apiRequest<AuthSession>('/api/auth/me');
  } catch (e: any) {
    if (e?.status === 401) return null;
    throw e;
  }
}

/** Выход. */
export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' });
}

/** Принятие приглашения компании по токену. */
export async function acceptInvitation(token: string): Promise<void> {
  await apiRequest(`/api/company-invitations/${token}/accept`, {
    method: 'POST',
  });
}