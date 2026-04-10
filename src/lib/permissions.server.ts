import "server-only";

import type { PermissionCapabilityKey } from "@/lib/permissions";
import { getCurrentUserRoleKeys } from "@/lib/session.server";
import {
  getAssetScopeForRoleKeys,
  getCapabilityMapForRoleKeys,
} from "@/modules/settings/permissions.service";
import { db } from "@/services/database";

export async function getCurrentUserPermissionContext() {
  const roleKeys = await getCurrentUserRoleKeys();
  const capabilities = await getCapabilityMapForRoleKeys(roleKeys);

  return {
    roleKeys,
    capabilities,
  };
}

export async function getCurrentUserSettingsPermissionContext() {
  const permissionContext = await getCurrentUserPermissionContext();

  return {
    ...permissionContext,
    canViewSettings: permissionContext.capabilities.viewSettings,
    canManagePermissions: permissionContext.capabilities.managePermissions,
  };
}

export async function getCurrentUserAssetPermissionContext() {
  const roleKeys = await getCurrentUserRoleKeys();
  const [capabilities, categories] = await Promise.all([
    getCapabilityMapForRoleKeys(roleKeys),
    db.category.findMany({
      select: {
        id: true,
        parentId: true,
      },
    }),
  ]);
  const assetScope = await getAssetScopeForRoleKeys(roleKeys, categories);

  return {
    roleKeys,
    capabilities,
    assetScope,
  };
}

export function hasCapability(
  capabilities: Record<PermissionCapabilityKey, boolean>,
  capabilityKey: PermissionCapabilityKey,
) {
  return capabilities[capabilityKey];
}
