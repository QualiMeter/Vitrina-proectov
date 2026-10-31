import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-loading">Загрузка…</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.some(r => session.roles.includes(r))) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}