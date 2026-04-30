import Link from "next/link";
import { redirect } from "next/navigation";

import { HeaderAssetSearch } from "@/components/layout/header-asset-search";
import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { LabelTemplateLibrary } from "@/modules/labels/components/label-template-library";
import { listLabelTemplates } from "@/modules/labels/label-template.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.capabilities.viewLabels) {
    redirect("/dashboard");
  }

  const templates = await listLabelTemplates();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Labels</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Label templates</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">Manage the reusable label definitions that future preview, browser printing, PDF output, and asset-level template selection flows will build on.</p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[320px] lg:flex-none">
              <HeaderAssetSearch compact />
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Link href="/settings/labels"><Button type="button" variant="ghost">Settings entry</Button></Link>
                {permissionContext.capabilities.editLabels ? (
                  <Link href="/labels/new"><Button type="button">New template</Button></Link>
                ) : null}
              </div>
            </div>
          </div>
        </PageHero>

        <LabelTemplateLibrary canEditTemplates={permissionContext.capabilities.editLabels} templates={templates} />
      </div>
    </AppShell>
  );
}
