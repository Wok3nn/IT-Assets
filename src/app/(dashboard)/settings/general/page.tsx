import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUser } from "@/lib/session";
import { GeneralSettingsPanels } from "@/modules/settings/components/general-settings-panels";
import {
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

  const startingAssetTagNumber = Number(formData.get("startingAssetTagNumber") ?? 5000);
  const statusIds = formData.getAll("statusId").map((value) => String(value ?? "").trim());
  const statusNames = formData.getAll("statusName").map((value) => String(value ?? "").trim());
  const statusColors = formData.getAll("statusColor").map((value) => String(value ?? "").trim());
  const newStatusName = String(formData.get("newStatusName") ?? "").trim();
  const newStatusColor = String(formData.get("newStatusColor") ?? "#f59e0b").trim();

  await updateGeneralSettings({ startingAssetTagNumber });

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

  const [setupState, currentUser, generalSettings, assetStatuses] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getGeneralSettings(),
    listAssetStatuses(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

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
