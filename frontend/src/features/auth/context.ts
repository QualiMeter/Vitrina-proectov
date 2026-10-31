import { createContext } from 'react';
import type { AuthSession, LoginPayload } from '../../api/auth';

export interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  csrfToken: string | null;
  ensureCsrf: () => Promise<string>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);