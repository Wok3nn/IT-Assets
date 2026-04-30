import { redirect } from "next/navigation";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { LabelsSettingsEntry } from "@/modules/labels/components/labels-settings-entry";
import { listLabelTemplates } from "@/modules/labels/label-template.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

export default async function LabelsSettingsPage() {
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

  if (!permissionContext.canViewSettings || !permissionContext.capabilities.viewLabels) {
    redirect("/settings");
  }

  const templates = await listLabelTemplates();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-100">Labels</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">Use Settings as the administrative entry point for label configuration, then manage and refine the reusable templates in the shared Labels library.</p>
            </div>
            <Link href="/settings"><Button type="button" variant="ghost">Back to settings</Button></Link>
          </div>
        </PageHero>

        <LabelsSettingsEntry canEditTemplates={permissionContext.capabilities.editLabels} templates={templates} />
      </div>
    </AppShell>
  );
}
