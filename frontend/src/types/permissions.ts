export type Permission = string;
export type PermissionSet = ReadonlySet<Permission>;
export type ObjectPermissions = Readonly<Record<string, boolean>>;

export interface AccessContext {
  permissions: PermissionSet;
  objectPermissions?: ObjectPermissions;
}
