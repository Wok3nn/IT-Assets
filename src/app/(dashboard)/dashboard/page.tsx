import { redirect } from "next/navigation";
import Link from "next/link";

import { HeaderAssetSearch } from "@/components/layout/header-asset-search";
import { PageHero } from "@/components/layout/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { getAssetSummary } from "@/modules/assets/asset.service";
import { getBorrowedItemsDashboardSummary } from "@/modules/borrowed-items/borrowed-items.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

function BorrowedItemsDashboardCard({
  summary,
}: {
  summary: Awaited<ReturnType<typeof getBorrowedItemsDashboardSummary>>;
}) {
  return (
    <section className="rounded-3xl border border-[#ece7df] bg-white/92 p-5 shadow-panel backdrop-blur dark:border-[#4b5255] dark:bg-[#34393c]/92">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Borrowed Items</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">Loan summary</h2>
        </div>
        <Link className="text-sm font-medium text-[#b56613] underline-offset-4 hover:underline dark:text-[#ffd1a0]" href="/borrowed-items">
          View All
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
          <p className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{summary.currentlyOut}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Currently Out</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-2xl font-semibold text-amber-800 dark:text-amber-200">{summary.dueToday}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Due Today</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-2xl font-semibold text-red-800 dark:text-red-200">{summary.overdue}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-red-700 dark:text-red-300">Overdue</p>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {summary.priorityItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-3.5 py-3 text-sm text-slate-500 dark:border-[#4b5255] dark:text-slate-400">No due or overdue borrowed items.</p>
        ) : summary.priorityItems.map((item) => (
          <div key={item.id} className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/95 px-3.5 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-950 dark:text-slate-100">{item.itemLabel}{item.quantity > 1 ? ` x${item.quantity}` : ""}</p>
              <span className={item.tone === "overdue" ? "text-xs font-semibold text-red-700 dark:text-red-300" : "text-xs font-semibold text-amber-700 dark:text-amber-300"}>{item.statusLabel}</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{item.borrowerName}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const [setupState, currentUser, assetSummary, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getAssetSummary(),
    getCurrentUserPermissionContext(),
  ]);

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
  const borrowedItemsSummary = permissionContext.capabilities.viewBorrowedItems ? await getBorrowedItemsDashboardSummary() : null;

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
        {borrowedItemsSummary ? <BorrowedItemsDashboardCard summary={borrowedItemsSummary} /> : null}
      </div>
    </AppShell>
  );
}
