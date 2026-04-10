import { redirect } from "next/navigation";
import Link from "next/link";

import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { ImportExportPanel } from "@/modules/settings/import-export-panel";
import { getImportExportReferenceData } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

const panelClass = "rounded-[32px] border border-[#ece7df] bg-white/92 p-6 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92 dark:shadow-[0_18px_40px_rgba(0,0,0,0.18)]";

export default async function ImportExportPage() {
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

  const references = await getImportExportReferenceData();

  return (
    <AppShell>
      <div className="space-y-6">
        <section className={panelClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Import / Export</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
                Export current data or import CSV files through a focused mapping workflow built for larger batches.
              </p>
            </div>
            <Link href="/settings"><Button type="button" variant="ghost">Back to settings</Button></Link>
          </div>
        </section>

        <ImportExportPanel references={references} />
      </div>
    </AppShell>
  );
}

