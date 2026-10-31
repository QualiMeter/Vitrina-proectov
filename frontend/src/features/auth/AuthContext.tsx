import React, { useCallback, useEffect, useState } from 'react';
import { fetchCsrfToken, me as apiMe, login as apiLogin, logout as apiLogout, type AuthSession, type LoginPayload } from '../../api/auth';
import { AuthContext} from './context';

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
  await ensureCsrf();
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
