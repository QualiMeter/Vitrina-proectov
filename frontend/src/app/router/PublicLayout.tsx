import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../../features/auth/AuthContext';

export function PublicLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}