import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import type { AvailableArea } from '../../api/auth';

export function ProtectedRoute({
  allowedArea,
  requiredPermissions = [],
}: {
  allowedArea: AvailableArea;
  requiredPermissions?: string[];
}) {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-loading">Загрузка…</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!session.user.availableAreas.includes(allowedArea)
    || !requiredPermissions.every(permission => session.user.permissions.includes(permission))) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
