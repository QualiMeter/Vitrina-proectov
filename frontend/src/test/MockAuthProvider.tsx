import type { ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from '../features/auth/context';

const guestSession: AuthContextValue = {
  session: null,
  isLoading: false,
  loadError: false,
  login: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
  retrySession: async () => {},
  adoptSession: () => {},
};

export function MockAuthProvider({ children, value = guestSession }: { children: ReactNode; value?: AuthContextValue }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
