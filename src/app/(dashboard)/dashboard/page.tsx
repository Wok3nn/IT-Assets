import { redirect } from "next/navigation";

import { StatCard } from "@/components/dashboard/stat-card";
import { AppShell } from "@/components/navigation/app-shell";
import { getAssetSummary } from "@/modules/assets/asset.service";
import { getCurrentUser } from "@/lib/session";
import { readSetupState } from "@/services/setup-state";

export default async function DashboardPage() {
  const [setupState, currentUser, assetSummary] = await Promise.all([readSetupState(), getCurrentUser(), getAssetSummary()]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  const stats = [
    {
      title: "Total assets",
      value: String(assetSummary.totalAssets),
      hint: assetSummary.totalAssets === 0 ? "Ready for the first tracked records" : "Tracked devices across the system",
    },
    {
      title: "Assigned",
      value: String(assetSummary.assignedAssets),
      hint: assetSummary.assignedAssets === 0 ? "Assignments will appear here" : "Assets currently deployed",
    },
    {
      title: "Maintenance",
      value: String(assetSummary.maintenanceAssets),
      hint: assetSummary.maintenanceAssets === 0 ? "No service events yet" : "Assets needing work",
    },
    {
      title: "Templates",
      value: String(assetSummary.labelTemplates),
      hint: assetSummary.labelTemplates === 0 ? "Create the first label layout" : "Label layouts available",
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-[32px] border border-[#ece7df] bg-white/92 p-6 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92 dark:shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Overview</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{setupState.siteName}</h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Signed in as {currentUser.email}. The dashboard shell is live and backed by server-side setup and local authentication.
          </p>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </section>
      </div>
    </AppShell>
  );
}
