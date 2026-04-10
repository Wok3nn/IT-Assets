import { z } from "zod";

import {
  createDefaultRolePermissionConfig,
  hasAdminRecoveryCapability,
  PERMISSION_CAPABILITY_OPTIONS,
  PERMISSION_NAV_OPTIONS,
  type PermissionCapabilityKey,
  type PermissionNavigationKey,
  type RoleAssetScopeConfig,
  type RolePermissionConfig,
} from "@/lib/permissions";
import { db } from "@/services/database";

const ROLE_PERMISSIONS_CATEGORY = "permissions";
const ROLE_PERMISSIONS_KEY_PREFIX = "permissions.role.";

const capabilityKeys = PERMISSION_CAPABILITY_OPTIONS.map((option) => option.key);
const navigationKeys = PERMISSION_NAV_OPTIONS.map((option) => option.key);
const defaultRolePermissionConfig = createDefaultRolePermissionConfig();
const roleAssetScopeModeSchema = z.enum(["all", "limited"]);
const roleAssetScopeRuleSchema = z.object({
  enabled: z.boolean().catch(false),
  ids: z.array(z.string().trim().cuid()).catch([]),
});
const navigationCapabilityMap: Partial<Record<PermissionNavigationKey, PermissionCapabilityKey>> = {
  assets: "viewAssets",
  categories: "viewCategories",
  departments: "viewDepartments",
  labels: "viewLabels",
  users: "viewUsers",
  locations: "viewLocations",
  settings: "viewSettings",
};

function buildBooleanShape<TKey extends string>(keys: readonly TKey[]) {
  return Object.fromEntries(keys.map((key) => [key, z.boolean().catch(true)])) as unknown as Record<
    TKey,
    z.ZodType<boolean>
  >;
}

function normalizeRoleAssetScopeConfig(assetScope: RoleAssetScopeConfig): RoleAssetScopeConfig {
  return {
    accessMode: assetScope.accessMode,
    categories: {
      ...assetScope.categories,
      ids: Array.from(new Set(assetScope.categories.ids)),
    },
    departments: {
      ...assetScope.departments,
      ids: Array.from(new Set(assetScope.departments.ids)),
    },
    locations: {
      ...assetScope.locations,
      ids: Array.from(new Set(assetScope.locations.ids)),
    },
  };
}

const rolePermissionConfigSchema = z.object({
  capabilities: z.object(
    buildBooleanShape<PermissionCapabilityKey>(capabilityKeys),
  ).catch(defaultRolePermissionConfig.capabilities),
  navigation: z.object(
    buildBooleanShape<PermissionNavigationKey>(navigationKeys),
  ).catch(defaultRolePermissionConfig.navigation),
  assetScope: z.object({
    accessMode: roleAssetScopeModeSchema.catch(defaultRolePermissionConfig.assetScope.accessMode),
    categories: roleAssetScopeRuleSchema.catch(defaultRolePermissionConfig.assetScope.categories),
    departments: roleAssetScopeRuleSchema.catch(defaultRolePermissionConfig.assetScope.departments),
    locations: roleAssetScopeRuleSchema.catch(defaultRolePermissionConfig.assetScope.locations),
  }).catch(defaultRolePermissionConfig.assetScope),
});

function getRolePermissionsSettingKey(roleKey: string) {
  return ROLE_PERMISSIONS_KEY_PREFIX + roleKey;
}

function mergeRolePermissionConfig(value: unknown): RolePermissionConfig {
  const defaults = defaultRolePermissionConfig;
  const parsed = rolePermissionConfigSchema.safeParse(value);

  if (!parsed.success) {
    return defaults;
  }

  return {
    capabilities: {
      ...defaults.capabilities,
      ...parsed.data.capabilities,
    },
    navigation: {
      ...defaults.navigation,
      ...parsed.data.navigation,
    },
    assetScope: normalizeRoleAssetScopeConfig({
      accessMode: parsed.data.assetScope.accessMode,
      categories: {
        ...defaults.assetScope.categories,
        ...parsed.data.assetScope.categories,
      },
      departments: {
        ...defaults.assetScope.departments,
        ...parsed.data.assetScope.departments,
      },
      locations: {
        ...defaults.assetScope.locations,
        ...parsed.data.assetScope.locations,
      },
    }),
  };
}

export async function getRolePermissionConfig(roleKey: string) {
  const setting = await db.setting.findUnique({
    where: {
      key: getRolePermissionsSettingKey(roleKey),
    },
    select: {
      value: true,
    },
  });

  if (!setting?.value) {
    return defaultRolePermissionConfig;
  }

  try {
    return mergeRolePermissionConfig(JSON.parse(setting.value));
  } catch {
    return defaultRolePermissionConfig;
  }
}

export async function updateRolePermissionConfig(roleKey: string, config: RolePermissionConfig) {
  const parsed = mergeRolePermissionConfig(config);

  await db.setting.upsert({
    where: {
      key: getRolePermissionsSettingKey(roleKey),
    },
    update: {
      category: ROLE_PERMISSIONS_CATEGORY,
      value: JSON.stringify(parsed),
    },
    create: {
      category: ROLE_PERMISSIONS_CATEGORY,
      key: getRolePermissionsSettingKey(roleKey),
      value: JSON.stringify(parsed),
    },
  });

  return parsed;
}

export async function assertSafeRolePermissionUpdate(input: {
  actorRoleKeys: string[];
  targetRoleKey: string;
  nextConfig: RolePermissionConfig;
}) {
  const parsed = mergeRolePermissionConfig(input.nextConfig);

  if (input.actorRoleKeys.includes(input.targetRoleKey) && !hasAdminRecoveryCapability(parsed)) {
    throw new Error("You cannot remove your own Settings or Permissions access while editing a role you currently use.");
  }

  const roles = await db.role.findMany({
    select: {
      key: true,
    },
  });

  const nextConfigs = await Promise.all(
    roles.map(async (role) => (
      role.key === input.targetRoleKey ? parsed : getRolePermissionConfig(role.key)
    )),
  );

  if (!nextConfigs.some((config) => hasAdminRecoveryCapability(config))) {
    throw new Error("Permission changes are blocked because they would leave the app without any role that can recover Settings and Permissions access.");
  }

  return parsed;
}

export async function getVisibleNavigationIdsForRoleKeys(roleKeys: string[]) {
  if (roleKeys.length === 0) {
    return [];
  }

  const configs = await Promise.all(roleKeys.map((roleKey) => getRolePermissionConfig(roleKey)));

  return PERMISSION_NAV_OPTIONS
    .filter((item) => {
      const requiredCapability = navigationCapabilityMap[item.key];
      const isVisible = configs.some((config) => config.navigation[item.key]);
      const hasRequiredCapability = requiredCapability
        ? configs.some((config) => config.capabilities[requiredCapability])
        : true;

      return isVisible && hasRequiredCapability;
    })
    .map((item) => item.key);
}

export async function getCapabilityMapForRoleKeys(roleKeys: string[]) {
  if (roleKeys.length === 0) {
    return Object.fromEntries(
      PERMISSION_CAPABILITY_OPTIONS.map((option) => [option.key, false]),
    ) as Record<PermissionCapabilityKey, boolean>;
  }

  const configs = await Promise.all(roleKeys.map((roleKey) => getRolePermissionConfig(roleKey)));

  return Object.fromEntries(
    PERMISSION_CAPABILITY_OPTIONS.map((option) => [
      option.key,
      configs.some((config) => config.capabilities[option.key]),
    ]),
  ) as Record<PermissionCapabilityKey, boolean>;
}

export async function getAssetScopeForRoleKeys(
  roleKeys: string[],
  categories: Array<{ id: string; parentId: string | null }>,
) {
  if (roleKeys.length === 0) {
    return {
      accessMode: "limited" as const,
      categoryIds: [] as string[],
      departmentIds: [] as string[],
      locationIds: [] as string[],
    };
  }

  const configs = await Promise.all(roleKeys.map((roleKey) => getRolePermissionConfig(roleKey)));

  if (configs.some((config) => config.assetScope.accessMode === "all")) {
    return {
      accessMode: "all" as const,
      categoryIds: [] as string[],
      departmentIds: [] as string[],
      locationIds: [] as string[],
    };
  }

  const categoryIds = Array.from(
    new Set(
      configs.flatMap((config) =>
        config.assetScope.categories.enabled
          ? expandRoleScopedCategoryIds(categories, config.assetScope.categories.ids)
          : [],
      ),
    ),
  );
  const departmentIds = Array.from(
    new Set(
      configs.flatMap((config) =>
        config.assetScope.departments.enabled ? config.assetScope.departments.ids : [],
      ),
    ),
  );
  const locationIds = Array.from(
    new Set(
      configs.flatMap((config) =>
        config.assetScope.locations.enabled ? config.assetScope.locations.ids : [],
      ),
    ),
  );

  return {
    accessMode: "limited" as const,
    categoryIds,
    departmentIds,
    locationIds,
  };
}

export function expandRoleScopedCategoryIds(
  categories: Array<{ id: string; parentId: string | null }>,
  selectedIds: string[],
) {
  if (selectedIds.length === 0) {
    return [];
  }

  const childMap = new Map<string | null, string[]>();

  for (const category of categories) {
    const siblings = childMap.get(category.parentId) ?? [];
    siblings.push(category.id);
    childMap.set(category.parentId, siblings);
  }

  const expanded = new Set<string>();
  const stack = [...selectedIds];

  while (stack.length > 0) {
    const categoryId = stack.pop();

    if (!categoryId || expanded.has(categoryId)) {
      continue;
    }

    expanded.add(categoryId);

    for (const childId of childMap.get(categoryId) ?? []) {
      stack.push(childId);
    }
  }

  return Array.from(expanded);
}
