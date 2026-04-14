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
                Export assets, users, categories, departments, locations, and labels or import CSV, XLSX, and JSON files through focused admin workflows, with labels using a JSON-first portable format.
              </p>
            </div>
            <Link href="/settings"><Button type="button" variant="ghost">Back to settings</Button></Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300">
              <p className="font-medium text-slate-900 dark:text-slate-100">CSV / XLSX</p>
              <p className="mt-1">Best for spreadsheet editing and larger admin cleanup passes.</p>
            </div>
            <div className="rounded-2xl border border-[#f2c28c] bg-[rgba(246,150,41,0.1)] px-4 py-3 text-sm text-[#9a5a13] dark:border-[#7f5a2d] dark:bg-[rgba(246,150,41,0.16)] dark:text-[#ffd1a0]">
              <p className="font-medium">JSON</p>
              <p className="mt-1">Best for full-fidelity structured exports and imports, especially for Labels.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300">
              <p className="font-medium text-slate-900 dark:text-slate-100">Duplicate handling</p>
              <p className="mt-1">Existing items are skipped during import so admins can re-run files safely.</p>
            </div>
          </div>
        </section>

        <ImportExportPanel references={references} />
      </div>
    </AppShell>
  );
}

