import { redirect } from "next/navigation";

import { HeaderAssetSearch } from "@/components/layout/header-asset-search";
import { PageHero } from "@/components/layout/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUser } from "@/lib/session.server";
import { getAssetSummary } from "@/modules/assets/asset.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

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
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Overview</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{setupState.siteName}</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
                Signed in as {currentUser.email}. The dashboard shell is live and backed by server-side setup and local authentication.
              </p>
            </div>
            <HeaderAssetSearch className="w-full xl:w-auto xl:flex-none" compact />
          </div>
        </PageHero>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </section>
      </div>
    </AppShell>
  );
}
