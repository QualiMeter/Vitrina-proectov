import React, { useCallback, useEffect, useState } from 'react';
import { me as apiMe, login as apiLogin, logout as apiLogout, type AuthSession, type LoginPayload } from '../../api/auth';
import { AuthContext } from './context';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Загрузка сессии
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const s = await apiMe();
        if (!cancelled) { setSession(s); setLoadError(false); }
      } catch {
        if (!cancelled) setLoadError(true);
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
    setLoadError(false);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setSession(null);
    setLoadError(false);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const s = await apiMe();
      setSession(s);
      setLoadError(false);
    } catch (error) {
      if (!session) setLoadError(true);
      throw error;
    }
  }, [session]);
  const retrySession = refreshSession;

  useEffect(() => {
    const handleSessionExpired = () => { void refreshSession().catch(() => undefined); };
    window.addEventListener('vitrina:session-expired', handleSessionExpired);
    return () => window.removeEventListener('vitrina:session-expired', handleSessionExpired);
  }, [refreshSession]);

  const adoptSession = useCallback((nextSession: AuthSession) => {
    setSession(nextSession);
    setLoadError(false);
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, loadError, login, logout, refreshSession, retrySession, adoptSession }}>
      {children}
    </AuthContext.Provider>
  );
}
