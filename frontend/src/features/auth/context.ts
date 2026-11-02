import { createContext } from 'react';
import type { AuthSession, LoginPayload } from '../../api/auth';

export interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  loadError: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  retrySession: () => Promise<void>;
  adoptSession: (session: AuthSession) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
