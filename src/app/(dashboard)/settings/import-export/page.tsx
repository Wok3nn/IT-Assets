import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUser } from "@/lib/session";
import { ImportExportPanel } from "@/modules/settings/import-export-panel";
import { getImportExportReferenceData } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

const panelClass = "rounded-[32px] border border-[#ece7df] bg-white/92 p-6 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92 dark:shadow-[0_18px_40px_rgba(0,0,0,0.18)]";

export default async function ImportExportPage() {
  const [setupState, currentUser, references] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getImportExportReferenceData(),
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
        <section className={panelClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Settings</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">Import / Export</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
                Export current data or import CSV files through a focused mapping workflow built for larger batches.
              </p>
            </div>
            <a className="inline-flex items-center justify-center rounded-full bg-[#F69629] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e5871e] hover:shadow-[0_12px_24px_rgba(246,150,41,0.28)] dark:text-[#2F3437] dark:hover:bg-[#ffab4b]" href="/settings">
              Back to settings
            </a>
          </div>
        </section>

        <ImportExportPanel references={references} />
      </div>
    </AppShell>
  );
}

