import type { ReactNode } from 'react';
import type { AccessContext, Permission } from '../../types/permissions';

type Props = {
  access: AccessContext | null;
  require: Permission | readonly Permission[];
  objectAction?: string;
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGate({ access, require, objectAction, fallback = null, children }: Props) {
  const required = Array.isArray(require) ? require : [require];
  const permitted = access !== null && required.every((permission) => access.permissions.has(permission))
    && (!objectAction || access.objectPermissions?.[objectAction] === true);
  return <>{permitted ? children : fallback}</>;
}
