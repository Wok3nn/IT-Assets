import { control, managed } from "@/modules/database-management/control-store";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import {
  getAuthenticationSettings,
  updateAuthenticationSettings,
  type AuthenticationGroupRoleMapping,
} from "@/modules/settings/authentication-settings.service";
import { AuthenticationSettingsPanel } from "@/modules/settings/components/authentication-settings-panel";
import { listAssignableRoles } from "@/modules/users/user.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

function getBooleanFormValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

async function saveAuthenticationSettingsAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserSettingsPermissionContext();

  if (!permissionContext.canViewSettings) {
    redirect("/dashboard");
  }

  const roleKeys = formData.getAll("groupMappingRoleKey").map((value) => String(value ?? "").trim());
  const roleNames = formData.getAll("groupMappingRoleName").map((value) => String(value ?? "").trim());
  const groupIds = formData.getAll("groupMappingGroupId").map((value) => String(value ?? "").trim());
  const groupNames = formData.getAll("groupMappingGroupName").map((value) => String(value ?? "").trim());
  const groupMappings: AuthenticationGroupRoleMapping[] = [];

  for (let index = 0; index < roleKeys.length; index += 1) {
    const roleKey = roleKeys[index] ?? "";
    const roleName = roleNames[index] ?? roleKey;
    const groupId = groupIds[index] ?? "";
    const groupName = groupNames[index] ?? "";

    if (roleKey && groupId) {
      groupMappings.push({ roleKey, roleName, groupId, groupName });
    }
  }

  try {
    await updateAuthenticationSettings({
      localAuthEnabled: getBooleanFormValue(formData, "localAuthEnabled"),
      entraEnabled: getBooleanFormValue(formData, "entraEnabled"),
      entraSsoEnabled: getBooleanFormValue(formData, "entraSsoEnabled"),
      entraTenantId: String(formData.get("entraTenantId") ?? "").trim(),
      entraClientId: String(formData.get("entraClientId") ?? "").trim(),
      entraSecretReference: String(formData.get("entraSecretReference") ?? "").trim(),
      entraRedirectUri: String(formData.get("entraRedirectUri") ?? "").trim(),
      groupMappings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication settings could not be saved.";
    redirect(`/settings/authentication?error=${encodeURIComponent(message)}`);
  }

  redirect("/settings/authentication?saved=true");
}

export default async function AuthenticationSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const savedParam = resolvedSearchParams?.saved;
  const errorParam = resolvedSearchParams?.error;
  const initialSaved = Array.isArray(savedParam) ? savedParam.includes("true") : savedParam === "true";
  const initialError = Array.isArray(errorParam) ? errorParam[0] : errorParam;

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

  const [authenticationSettings, roles] = await Promise.all([
    getAuthenticationSettings(),
    listAssignableRoles(),
  ]);

  return (
    <AppShell>
      <AuthenticationSettingsPanel
        installationEntra={managed() && Boolean(control().entraRuntime())}
        initialError={initialError}
        initialSaved={initialSaved}
        roles={roles.map((role) => ({ key: role.key, name: role.name }))}
        saveAuthenticationSettingsAction={saveAuthenticationSettingsAction}
        settings={process.env.IT_ASSETS_MANAGED === "1" ? {
          ...authenticationSettings,
          entraSecretReference: /^IT_ASSETS_ENTRA_SECRET_[A-Z0-9_]+$/.test(authenticationSettings.entraSecretReference) ? authenticationSettings.entraSecretReference : "",
        } : authenticationSettings}
      />
    </AppShell>
  );
}
