import { redirect } from "next/navigation";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { canManageSettings } from "@/lib/permissions";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser, getCurrentUserRoleKeys } from "@/lib/session.server";
import { ResetManagementPanel } from "@/modules/settings/components/reset-management-panel";
import { getResetOverview } from "@/modules/settings/reset-management.service";
import { readSetupState } from "@/services/setup-state";

export default async function ResetSettingsPage() {
  const [setupState, currentUser, roleKeys, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserRoleKeys(),
    getCurrentUserSettingsPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.canViewSettings || !canManageSettings(roleKeys)) {
    redirect("/settings");
  }

  const overview = await getResetOverview();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Reset</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
                Centralized reset management for destructive admin-only cleanup tasks. Every reset requires an explicit confirmation before data is removed.
              </p>
            </div>
            <Link href="/settings"><Button type="button" variant="ghost">Back to settings</Button></Link>
          </div>
        </PageHero>

        <ResetManagementPanel overview={overview} />
      </div>
    </AppShell>
  );
}
