import type { ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from '../features/auth/context';

const guestSession: AuthContextValue = {
  session: null,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
  adoptSession: () => {},
};

export function MockAuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={guestSession}>{children}</AuthContext.Provider>;
}
