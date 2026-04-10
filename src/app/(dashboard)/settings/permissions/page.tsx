import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { AppShell } from "@/components/navigation/app-shell";
import {
  PERMISSION_CAPABILITY_OPTIONS,
  PERMISSION_NAV_OPTIONS,
  type PermissionCapabilityKey,
  type PermissionNavigationKey,
  type RolePermissionConfig,
} from "@/lib/permissions";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { listAssetReferenceData } from "@/modules/assets/asset.service";
import { PermissionsSettingsPanel } from "@/modules/settings/components/permissions-settings-panel";
import {
  assertSafeRolePermissionUpdate,
  getRolePermissionConfig,
  updateRolePermissionConfig,
} from "@/modules/settings/permissions.service";
import { listAssignableRoles } from "@/modules/users/user.service";
import { readSetupState } from "@/services/setup-state";

type PermissionsSettingsPageProps = {
  searchParams?: Promise<{
    error?: string;
    roleKey?: string;
    saved?: string;
  }>;
};

type ScopeOption = {
  id: string;
  label: string;
  helper?: string;
};

type ReferenceCategory = {
  id: string;
  name: string;
  parentId: string | null;
};

function getCheckedFlag(formData: FormData, name: string) {
  return formData.get(name) === "true";
}

function getCheckedIds(formData: FormData, name: string) {
  return Array.from(
    new Set(
      formData
        .getAll(name)
        .map((value) => value.toString().trim())
        .filter(Boolean),
    ),
  );
}

function buildHierarchyOptions(items: Array<{ id: string; name: string; parentId: string | null }>, helperLabel: string): ScopeOption[] {
  const itemById = new Map(items.map((item) => [item.id, item]));

  const buildPathLabel = (item: { id: string; name: string; parentId: string | null }) => {
    const labels: string[] = [];
    const seen = new Set<string>();
    let current: { id: string; name: string; parentId: string | null } | undefined = item;

    while (current && !seen.has(current.id)) {
      labels.unshift(current.name);
      seen.add(current.id);
      current = current.parentId ? itemById.get(current.parentId) : undefined;
    }

    return labels.join(" / ");
  };

  return items.map((item) => ({
    id: item.id,
    label: buildPathLabel(item),
    helper: item.parentId ? helperLabel : undefined,
  }));
}

function buildParentCategoryOptions(categories: ReferenceCategory[]): ScopeOption[] {
  return categories
    .filter((category) => category.parentId === null)
    .map((category) => ({
      id: category.id,
      label: category.name,
      helper: "Includes the full category branch.",
    }));
}

function normalizeCategoryScopeIdsToRootCategories(
  categories: ReferenceCategory[],
  selectedIds: string[],
) {
  if (selectedIds.length === 0) {
    return [];
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return Array.from(
    new Set(
      selectedIds.flatMap((selectedId) => {
        let current = categoryById.get(selectedId);
        let root = current;
        const seen = new Set<string>();

        while (current && current.parentId && !seen.has(current.id)) {
          seen.add(current.id);
          const parent = categoryById.get(current.parentId);

          if (!parent) {
            break;
          }

          root = parent;
          current = parent;
        }

        return root ? [root.id] : [];
      }),
    ),
  );
}

function normalizeRolePermissionConfigForPermissionsPage(
  config: RolePermissionConfig | null,
  categories: ReferenceCategory[],
) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    assetScope: {
      ...config.assetScope,
      categories: {
        ...config.assetScope.categories,
        ids: normalizeCategoryScopeIdsToRootCategories(categories, config.assetScope.categories.ids),
      },
    },
  };
}

async function saveRolePermissionsAction(formData: FormData) {
  "use server";

  const roleKey = formData.get("roleKey")?.toString().trim() ?? "";
  const currentUser = await getCurrentUser();
  const permissionContext = await getCurrentUserSettingsPermissionContext();

  if (!currentUser) {
    redirect("/login");
  }

  if (!roleKey || !permissionContext.canViewSettings || !permissionContext.canManagePermissions) {
    redirect("/settings/permissions");
  }

  const nextConfig: RolePermissionConfig = {
    capabilities: Object.fromEntries(
      PERMISSION_CAPABILITY_OPTIONS.map((option) => [
        option.key,
        getCheckedFlag(formData, `capability:${option.key}`),
      ]),
    ) as Record<PermissionCapabilityKey, boolean>,
    navigation: Object.fromEntries(
      PERMISSION_NAV_OPTIONS.map((option) => [
        option.key,
        getCheckedFlag(formData, `navigation:${option.key}`),
      ]),
    ) as Record<PermissionNavigationKey, boolean>,
    assetScope: {
      accessMode: formData.get("assetScope:accessMode") === "limited" ? "limited" : "all",
      categories: {
        enabled: getCheckedFlag(formData, "assetScope:categories:enabled"),
        ids: getCheckedIds(formData, "assetScope:categories:ids"),
      },
      departments: {
        enabled: getCheckedFlag(formData, "assetScope:departments:enabled"),
        ids: getCheckedIds(formData, "assetScope:departments:ids"),
      },
      locations: {
        enabled: getCheckedFlag(formData, "assetScope:locations:enabled"),
        ids: getCheckedIds(formData, "assetScope:locations:ids"),
      },
    },
  };

  try {
    const safeConfig = await assertSafeRolePermissionUpdate({
      actorRoleKeys: permissionContext.roleKeys,
      targetRoleKey: roleKey,
      nextConfig,
    });

    await updateRolePermissionConfig(roleKey, safeConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Permission update blocked.";
    redirect(`/settings/permissions?roleKey=${encodeURIComponent(roleKey)}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/permissions");
  redirect(`/settings/permissions?roleKey=${encodeURIComponent(roleKey)}&saved=true`);
}

export default async function PermissionsSettingsPage({ searchParams }: PermissionsSettingsPageProps) {
  const params = (await searchParams) ?? {};

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserSettingsPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.canViewSettings) {
    redirect("/dashboard");
  }

  if (!permissionContext.canManagePermissions) {
    redirect("/settings");
  }

  const [roles, assetReferenceData] = await Promise.all([
    listAssignableRoles(),
    listAssetReferenceData(),
  ]);

  const selectedRole = roles.find((role) => role.key === params.roleKey) ?? roles[0] ?? null;
  const rawSelectedConfig = selectedRole ? await getRolePermissionConfig(selectedRole.key) : null;
  const selectedConfig = normalizeRolePermissionConfigForPermissionsPage(rawSelectedConfig, assetReferenceData.categories);
  const initialError = params.error?.trim() || null;
  const initialSaved = params.saved === "true";
  const categoryOptions = buildParentCategoryOptions(assetReferenceData.categories);
  const locationOptions = buildHierarchyOptions(assetReferenceData.locations, "Location branch stays available.");
  const departmentOptions = assetReferenceData.scopes.map((scope) => ({
    id: scope.id,
    label: scope.name,
    helper: scope.slug,
  }));

  return (
    <AppShell>
      <PermissionsSettingsPanel
        categoryOptions={categoryOptions}
        departmentOptions={departmentOptions}
        initialError={initialError}
        initialSaved={initialSaved}
        locationOptions={locationOptions}
        roles={roles}
        saveAction={saveRolePermissionsAction}
        selectedConfig={selectedConfig}
        selectedRole={selectedRole}
      />
    </AppShell>
  );
}
