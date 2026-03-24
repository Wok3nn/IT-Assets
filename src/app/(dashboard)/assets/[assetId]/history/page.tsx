import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";
import { buildAssetHref, normalizeAssetsReturnTo } from "@/modules/assets/assets-routing";
import { getAssetAuditHistory, getAssetById } from "@/modules/assets/asset.service";
import { readSetupState } from "@/services/setup-state";

const panelClass = "rounded-[32px] border border-[#ece7df] bg-white/92 p-6 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92 dark:shadow-[0_18px_40px_rgba(0,0,0,0.18)]";
const cardClass = "rounded-3xl border border-[#ece7df] bg-white/92 p-5 shadow-panel backdrop-blur dark:border-[#4b5255] dark:bg-[#34393c]/92 dark:shadow-[0_18px_40px_rgba(0,0,0,0.16)]";

type AssetHistoryPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams?: Promise<{ days?: string; returnTo?: string }>;
};

function parseDays(value?: string) {
  if (value === "7" || value === "30" || value === "90") {
    return Number(value);
  }

  return null;
}

function formatDateTimeLabel(value?: Date | null) {
  return value ? value.toLocaleString() : "Not recorded";
}

export default async function AssetHistoryPage({ params, searchParams }: AssetHistoryPageProps) {
  const { assetId } = await params;
  const search = (await searchParams) ?? {};
  const days = parseDays(search.days);
  const returnTo = normalizeAssetsReturnTo(search.returnTo ?? null);

  const [setupState, currentUser] = await Promise.all([readSetupState(), getCurrentUser()]);
  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");

  const [asset, history] = await Promise.all([
    getAssetById(assetId),
    getAssetAuditHistory(assetId, days),
  ]);

  if (!asset) notFound();

  const dayOptions = [
    { label: "7 days", value: "7" },
    { label: "30 days", value: "30" },
    { label: "90 days", value: "90" },
    { label: "All history", value: "all" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <section className={panelClass}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Assets</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Asset history</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[#f0d3b4] bg-[#fff4e8] px-3 py-1 text-xs font-medium text-[#b56613] dark:border-[#6f5530] dark:bg-[rgba(246,150,41,0.16)] dark:text-[#ffd7ab]">{asset.assetTag}</span>
                {asset.status ? <AssetStatusPill color={asset.status.color} label={asset.status.name} /> : null}
              </div>
            </div>
            <div className="flex gap-3">
              <Link href={buildAssetHref(asset.id, { section: "edit", returnTo })}>
                <Button type="button" variant="secondary">Edit asset</Button>
              </Link>
              <Link href={returnTo}>
                <Button type="button" variant="ghost">Back to assets</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">History timeline</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Filter by a recent time window or inspect the full activity log.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {dayOptions.map((option) => {
                const href = buildAssetHref(asset.id, { section: "history", days: option.value === "all" ? null : option.value, returnTo });
                const isActive = option.value === "all" ? days === null : String(days) === option.value;
                return (
                  <Link key={option.value} href={href}>
                    <Button type="button" variant={isActive ? "primary" : "secondary"}>{option.label}</Button>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#ece7df] px-4 py-5 text-sm text-slate-500 dark:border-[#4b5255] dark:text-slate-400">No audit history has been recorded in this time window.</div>
            ) : (
              history.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-4 dark:border-[#4b5255] dark:bg-[#2f3437]">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">{entry.summary}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.actor?.name ?? "System"} - {entry.action}</p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTimeLabel(entry.createdAt)}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
