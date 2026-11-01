import React, { useCallback, useEffect, useState } from 'react';
import { me as apiMe, login as apiLogin, logout as apiLogout, type AuthSession, type LoginPayload } from '../../api/auth';
import { AuthContext } from './context';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const login = useCallback(async (payload: LoginPayload) => {
    const nextSession = await apiLogin(payload);
    setSession(nextSession);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setSession(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const s = await apiMe();
    setSession(s);
  }, []);

  const adoptSession = useCallback((nextSession: AuthSession) => {
    setSession(nextSession);
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout, refreshSession, adoptSession }}>
      {children}
    </AuthContext.Provider>
  );
}
