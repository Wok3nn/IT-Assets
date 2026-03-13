export const SYSTEM_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  VIEWER: "VIEWER",
} as const;

export function canManageSettings(roleKeys: string[]) {
  return roleKeys.includes(SYSTEM_ROLES.SUPER_ADMIN);
}
