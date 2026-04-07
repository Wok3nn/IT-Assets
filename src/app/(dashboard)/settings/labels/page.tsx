import { redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUser } from "@/lib/session";
import { LabelsSettingsEntry } from "@/modules/labels/components/labels-settings-entry";
import { listLabelTemplates } from "@/modules/labels/label-template.service";
import { readSetupState } from "@/services/setup-state";

export default async function LabelsSettingsPage() {
  const [setupState, currentUser, templates] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    listLabelTemplates(),
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
        <PageHero>
          <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-100">Labels</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">Use Settings as the administrative entry point for label configuration, then manage and refine the reusable templates in the shared Labels library.</p>
        </PageHero>

        <LabelsSettingsEntry templates={templates} />
      </div>
    </AppShell>
  );
}
