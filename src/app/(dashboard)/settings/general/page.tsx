import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { GeneralSettingsPanels } from "@/modules/settings/components/general-settings-panels";
import {
  DEFAULT_APP_TITLE,
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  getGeneralSettings,
  listAssetStatuses,
  updateGeneralSettings,
  upsertAssetStatus,
} from "@/modules/settings/settings.service";
import { readSetupState } from "@/services/setup-state";

type AssetStatus = {
  id: string;
  key: string;
  name: string;
  color: string | null;
  _count: {
    assets: number;
  };
};

async function saveGeneralSettingsAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserSettingsPermissionContext();

  if (!permissionContext.canViewSettings) {
    redirect("/dashboard");
  }

  const appTitle = String(formData.get("appTitle") ?? DEFAULT_APP_TITLE).trim() || DEFAULT_APP_TITLE;
  const sessionTimeoutMinutes = Number(formData.get("sessionTimeoutMinutes") ?? DEFAULT_SESSION_TIMEOUT_MINUTES);
  const startingAssetTagNumber = Number(formData.get("startingAssetTagNumber") ?? 5000);
  const statusIds = formData.getAll("statusId").map((value) => String(value ?? "").trim());
  const statusNames = formData.getAll("statusName").map((value) => String(value ?? "").trim());
  const statusColors = formData.getAll("statusColor").map((value) => String(value ?? "").trim());
  const newStatusName = String(formData.get("newStatusName") ?? "").trim();
  const newStatusColor = String(formData.get("newStatusColor") ?? "#f59e0b").trim();

  await updateGeneralSettings({ appTitle, sessionTimeoutMinutes, startingAssetTagNumber });

  for (let index = 0; index < statusNames.length; index += 1) {
    const name = statusNames[index] ?? "";
    const color = statusColors[index] ?? "#94a3b8";
    const statusId = statusIds[index] || undefined;

    await upsertAssetStatus({ statusId, name, color });
  }

  if (newStatusName) {
    await upsertAssetStatus({ name: newStatusName, color: newStatusColor });
  }

  redirect("/settings/general?saved=true");
}

export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const savedParam = resolvedSearchParams?.saved;
  const initialSaved = Array.isArray(savedParam) ? savedParam.includes("true") : savedParam === "true";

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

  const [generalSettings, assetStatuses] = await Promise.all([
    getGeneralSettings(),
    listAssetStatuses(),
  ]);

  return (
    <AppShell>
      <GeneralSettingsPanels
        assetStatuses={assetStatuses as AssetStatus[]}
        generalSettings={generalSettings}
        initialSaved={initialSaved}
        saveGeneralSettingsAction={saveGeneralSettingsAction}
      />
    </AppShell>
  );
}
