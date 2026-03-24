import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { TextField } from "@/components/forms/text-field";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";
import { getCurrentUser } from "@/lib/session";
import {
  getGeneralSettings,
  listAssetStatuses,
  upsertAssetStatus,
  updateGeneralSettings,
} from "@/modules/settings/settings.service";
import { readSetupState } from "@/services/setup-state";

const navCardClass = "group block rounded-3xl border border-[#ece7df] bg-white/92 p-5 shadow-panel backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#f0c48d] hover:shadow-[0_22px_42px_rgba(246,150,41,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69629]/40 dark:border-[#4b5255] dark:bg-[#34393c]/92 dark:hover:border-[#f0a853] dark:hover:shadow-[0_18px_34px_rgba(0,0,0,0.22)]";

async function updateGeneralSettingsAction(formData: FormData) {
  "use server";

  await updateGeneralSettings({
    startingAssetTagNumber: Number(formData.get("startingAssetTagNumber") ?? 5000),
  });

  revalidatePath("/settings");
  revalidatePath("/assets");
  redirect("/settings");
}

async function upsertAssetStatusAction(formData: FormData) {
  "use server";

  await upsertAssetStatus({
    statusId: formData.get("statusId")?.toString() || undefined,
    name: formData.get("name")?.toString() ?? "",
    color: formData.get("color")?.toString() ?? "",
  });

  revalidatePath("/settings");
  revalidatePath("/assets");
  revalidatePath("/assets/new");
  redirect("/settings");
}

const futureCards = [
  { title: "Theme Settings", description: "Theme colors, light/dark defaults, and UI appearance controls are still staged." },
  { title: "Labels", description: "Label templates and print configuration will move into a dedicated settings surface." },
  { title: "Branding Settings", description: "Site identity, logo, and organization branding are planned here." },
  { title: "Authentication Settings", description: "Authentication providers and future Entra configuration will live here." },
];

export default async function SettingsPage() {
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
      <div className="space-y-6">
        <PageHero as="div">
          <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-100">Settings</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
            Configure the workspace through focused cards. High-volume tools like import and export now live on their own page.
          </p>
        </PageHero>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <PanelCard>
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">General Settings</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Set the first numeric asset tag. New assets automatically receive the next available number at or above this value.
              </p>
            </div>
            <form action={updateGeneralSettingsAction} className="mt-6 space-y-4">
              <FieldLabel>
                <FieldLabelText>Starting asset tag number</FieldLabelText>
                <TextField
                  defaultValue={generalSettings.startingAssetTagNumber}
                  min={1}
                  name="startingAssetTagNumber"
                  step={1}
                  type="number"
                />
              </FieldLabel>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Example: if this is `5000` and tags `5000` through `5100` already exist, the next new asset receives `5101`.
              </p>
              <Button type="submit">Save general settings</Button>
            </form>
          </PanelCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link className={`${navCardClass} sm:col-span-2`} href="/settings/import-export">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Navigation</p>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950 transition group-hover:text-[#b56613] dark:text-slate-100 dark:group-hover:text-[#ffd1a0]">Import / Export</h2>
                  <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">
                    Open the dedicated CSV workspace for exports, file uploads, mapping, validation, and import confirmation.
                  </p>
                </div>
                <span className="rounded-full bg-[rgba(246,150,41,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">
                  Open
                </span>
              </div>
            </Link>

            {futureCards.map((card) => (
              <PanelCard as="div" key={card.title}>
                <h2 className="text-lg font-medium text-slate-950 dark:text-slate-100">{card.title}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{card.description}</p>
              </PanelCard>
            ))}
          </div>
        </div>

        <PanelCard>
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Asset statuses</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Change default status colors, rename existing statuses, or add new ones for your own workflow.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {assetStatuses.map((status) => (
              <form key={status.id} action={upsertAssetStatusAction} className="rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#2f3437]">
                <input name="statusId" type="hidden" value={status.id} />
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                  <FieldLabel className="flex-1">
                    <FieldLabelText>Name</FieldLabelText>
                    <TextField defaultValue={status.name} name="name" type="text" />
                  </FieldLabel>
                  <FieldLabel className="w-full lg:max-w-36">
                    <FieldLabelText>Color</FieldLabelText>
                    <TextField className="h-[52px] p-2" defaultValue={status.color ?? "#94a3b8"} name="color" type="color" />
                  </FieldLabel>
                  <div className="min-w-40 space-y-2">
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Preview</span>
                    <div className="flex h-[52px] items-center">
                      <AssetStatusPill color={status.color} label={status.name} />
                    </div>
                  </div>
                  <div className="min-w-28 space-y-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="block font-medium text-slate-700 dark:text-slate-200">In use</span>
                    <span>{status._count.assets} asset{status._count.assets === 1 ? "" : "s"}</span>
                  </div>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            ))}
          </div>

          <form action={upsertAssetStatusAction} className="mt-6 rounded-3xl border border-dashed border-[#ece7df] p-4 dark:border-[#4b5255]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <FieldLabel className="flex-1">
                <FieldLabelText>New status name</FieldLabelText>
                <TextField name="name" placeholder="Awaiting disposal" type="text" />
              </FieldLabel>
              <FieldLabel className="w-full lg:max-w-36">
                <FieldLabelText>Color</FieldLabelText>
                <TextField className="h-[52px] p-2" defaultValue="#f59e0b" name="color" type="color" />
              </FieldLabel>
              <Button type="submit">Add status</Button>
            </div>
          </form>
        </PanelCard>
      </div>
    </AppShell>
  );
}

