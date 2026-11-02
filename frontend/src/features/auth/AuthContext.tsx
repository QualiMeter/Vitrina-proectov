import React, { useCallback, useEffect, useRef, useState } from 'react';
import { me as apiMe, login as apiLogin, logout as apiLogout, type AuthSession, type LoginPayload } from '../../api/auth';
import { AuthContext } from './context';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const sessionRevision = useRef(0);

  useEffect(() => {
    let active = true;
    const revision = sessionRevision.current;

    async function load() {
      setIsLoading(true);

      try {
        const currentSession = await apiMe();

        if (active && sessionRevision.current === revision) {
          setSession(currentSession);
          setLoadError(false);
        }
      } catch {
        if (active && sessionRevision.current === revision) {
          setLoadError(true);
        }
      } finally {
        if (active && sessionRevision.current === revision) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const revision = ++sessionRevision.current;
    setIsLoading(false);

    const nextSession = await apiLogin(payload);

    if (sessionRevision.current !== revision) {
      return;
    }

    setSession(nextSession);
    setLoadError(false);
  }, []);

  const logout = useCallback(async () => {
    const revision = ++sessionRevision.current;
    setIsLoading(false);

    await apiLogout();

    if (sessionRevision.current !== revision) {
      return;
    }

    setSession(null);
    setLoadError(false);
  }, []);

  const refreshSession = useCallback(async () => {
    const revision = ++sessionRevision.current;
    setIsLoading(true);

    try {
      const currentSession = await apiMe();

      if (sessionRevision.current === revision) {
        setSession(currentSession);
        setLoadError(false);
      }
    } catch (error) {
      if (sessionRevision.current === revision) {
        setLoadError(true);
      }

      throw error;
    } finally {
      if (sessionRevision.current === revision) {
        setIsLoading(false);
      }
    }
  }, []);

  const retrySession = refreshSession;

  useEffect(() => {
    const handleSessionExpired = () => {
      sessionRevision.current += 1;
      setSession(null);
      setLoadError(false);
      setIsLoading(false);
    };

    window.addEventListener('vitrina:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('vitrina:session-expired', handleSessionExpired);
    };
  }, []);

  const adoptSession = useCallback((nextSession: AuthSession) => {
    sessionRevision.current += 1;
    setSession(nextSession);
    setLoadError(false);
    setIsLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, loadError, login, logout, refreshSession, retrySession, adoptSession }}>
      {children}
    </AuthContext.Provider>
  );
}
