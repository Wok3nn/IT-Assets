export const SYSTEM_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  VIEWER: "VIEWER",
} as const;

export const PERMISSION_CAPABILITY_OPTIONS = [
  { key: "viewAssets", label: "View assets", description: "Browse the asset directory and open asset records." },
  { key: "createAssets", label: "Create assets", description: "Add new assets into the inventory workflow." },
  { key: "editAssets", label: "Edit assets", description: "Update asset details and related assignments." },
  { key: "deleteAssets", label: "Delete assets", description: "Remove asset records from the app." },
  { key: "manageAssetTransfers", label: "Check in / check out", description: "Use the transfer workflow to assign or return assets." },
  { key: "bulkEditAssets", label: "Bulk edit assets", description: "Run limited multi-asset updates from the dedicated bulk editor." },
  { key: "printLabels", label: "Print labels", description: "Open label preview and print flows for assets." },
  { key: "viewUsers", label: "View users", description: "Browse the users directory and role-based user views." },
  { key: "editUsers", label: "Edit users", description: "Create or update users, roles, and department memberships." },
  { key: "viewCategories", label: "View categories", description: "Browse categories and their nested structure." },
  { key: "editCategories", label: "Edit categories", description: "Create or update category records." },
  { key: "viewDepartments", label: "View departments", description: "Browse department records and related scope data." },
  { key: "editDepartments", label: "Edit departments", description: "Create or update department records." },
  { key: "viewLocations", label: "View locations", description: "Browse locations and their nested structure." },
  { key: "editLocations", label: "Edit locations", description: "Create or update location records." },
  { key: "viewLabels", label: "View labels", description: "Browse reusable label templates and print surfaces." },
  { key: "editLabels", label: "Edit labels", description: "Create, update, and maintain label templates." },
  { key: "viewSettings", label: "View settings", description: "Open the settings hub and related configuration pages." },
  { key: "managePermissions", label: "Manage permissions", description: "Open the permissions workspace and change role configuration." },
] as const;

export const PERMISSION_NAV_OPTIONS = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "assets", label: "Assets", href: "/assets" },
  { key: "categories", label: "Categories", href: "/categories" },
  { key: "departments", label: "Departments", href: "/scopes" },
  { key: "labels", label: "Labels", href: "/labels" },
  { key: "users", label: "Users", href: "/users" },
  { key: "locations", label: "Locations", href: "/locations" },
  { key: "patchNotes", label: "Patch Notes", href: "/patch-notes" },
  { key: "settings", label: "Settings", href: "/settings" },
] as const;

export type PermissionCapabilityKey = (typeof PERMISSION_CAPABILITY_OPTIONS)[number]["key"];
export type PermissionNavigationKey = (typeof PERMISSION_NAV_OPTIONS)[number]["key"];
export type RoleAssetScopeMode = "all" | "limited";
export type RoleAssetScopeRule = {
  enabled: boolean;
  ids: string[];
};

export type RoleAssetScopeConfig = {
  accessMode: RoleAssetScopeMode;
  categories: RoleAssetScopeRule;
  departments: RoleAssetScopeRule;
  locations: RoleAssetScopeRule;
};

export type RolePermissionConfig = {
  capabilities: Record<PermissionCapabilityKey, boolean>;
  navigation: Record<PermissionNavigationKey, boolean>;
  assetScope: RoleAssetScopeConfig;
};

export function canManageSettings(roleKeys: string[]) {
  return roleKeys.includes(SYSTEM_ROLES.SUPER_ADMIN);
}

export function hasAdminRecoveryCapability(config: Pick<RolePermissionConfig, "capabilities">) {
  return config.capabilities.viewSettings && config.capabilities.managePermissions;
}

export function createDefaultRolePermissionConfig(): RolePermissionConfig {
  return {
    capabilities: Object.fromEntries(
      PERMISSION_CAPABILITY_OPTIONS.map((option) => [option.key, true]),
    ) as Record<PermissionCapabilityKey, boolean>,
    navigation: Object.fromEntries(
      PERMISSION_NAV_OPTIONS.map((option) => [option.key, true]),
    ) as Record<PermissionNavigationKey, boolean>,
    assetScope: {
      accessMode: "all",
      categories: {
        enabled: false,
        ids: [],
      },
      departments: {
        enabled: false,
        ids: [],
      },
      locations: {
        enabled: false,
        ids: [],
      },
    },
  };
}

