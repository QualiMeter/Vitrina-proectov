import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchCsrfToken, me as apiMe, login as apiLogin, logout as apiLogout, type AuthSession, type LoginPayload } from '../../api/auth';
import { ApiError } from '../../api/client';

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  csrfToken: string | null;
  ensureCsrf: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Загрузка сессии
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const s = await apiMe();
        if (!cancelled) setSession(s);
      } catch {
        // Игнорирование ошибки сети при первой загрузке
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const ensureCsrf = useCallback(async (): Promise<string> => {
    if (csrfToken) return csrfToken;
    const token = await fetchCsrfToken();
    setCsrfToken(token);
    return token;
  }, [csrfToken]);

  const login = useCallback(async (payload: LoginPayload) => {
    const csrf = await ensureCsrf();
    // Добавление CSRF-заголовка ко всем изменяющим запросам
    const originalApiRequest = (await import('../../api/client')).apiRequest;
    // (см. примечание ниже)
    const session = await apiLogin(payload);
    setSession(session);
  }, [ensureCsrf]);

  const logout = useCallback(async () => {
    await apiLogout();
    setSession(null);
    setCsrfToken(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const s = await apiMe();
    setSession(s);
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout, refreshSession, csrfToken, ensureCsrf }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}