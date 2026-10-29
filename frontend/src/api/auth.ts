import type { Permission, ObjectPermissions } from '../types/permissions';

/** Shape to adapt when the identity contract is published. No auth request is made yet. */
export interface AuthSession {
  userId: string;
  displayName: string;
  permissions: readonly Permission[];
}
export interface ResourceAccess { resourceId: string; actions: ObjectPermissions; }
