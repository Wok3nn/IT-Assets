import { redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { canManageSettings } from "@/lib/permissions";
import { getCurrentUser, getCurrentUserRoleKeys } from "@/lib/session";
import { ResetManagementPanel } from "@/modules/settings/components/reset-management-panel";
import { getResetOverview } from "@/modules/settings/reset-management.service";
import { readSetupState } from "@/services/setup-state";

export default async function ResetSettingsPage() {
  const [setupState, currentUser, roleKeys, overview] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserRoleKeys(),
    getResetOverview(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!canManageSettings(roleKeys)) {
    redirect("/settings");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Reset</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
            Centralized reset management for destructive admin-only cleanup tasks. Every reset requires an explicit confirmation before data is removed.
          </p>
        </PageHero>

        <ResetManagementPanel overview={overview} />
      </div>
    </AppShell>
  );
}
