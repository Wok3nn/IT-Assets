import { notFound, redirect } from "next/navigation";

import { requireBootstrapPage } from "@/lib/bootstrap.server";
import { buildAssetLookupPath } from "@/modules/assets/assets-routing";
import { getAssetById } from "@/modules/assets/asset.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type AssetLookupPageProps = {
  params: Promise<{
    assetId: string;
  }>;
};

function LookupField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-[#ece7df] bg-white/88 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-[#4b5255] dark:bg-[#34393c]/92">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default async function AssetLookupPage({ params }: AssetLookupPageProps) {
  await requireBootstrapPage();

  const { assetId } = await params;
  const [setupState, asset] = await Promise.all([readSetupState(), getAssetById(assetId)]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!asset) {
    notFound();
  }

  const assigneeLabel = asset.assignedUser?.name ?? asset.assignedGuestProfile?.displayName ?? "Unassigned";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_42%),linear-gradient(180deg,#f8fafc_0%,#eef2f6_100%)] px-4 py-6 dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.12),_transparent_42%),linear-gradient(180deg,#2f3437_0%,#252a2d_100%)] sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <section className="rounded-[32px] border border-[#ece7df] bg-white/94 p-6 shadow-panel dark:border-[#4b5255] dark:bg-[#34393c]/94">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Asset lookup</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{asset.assetTag}</h1>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-300">{asset.model?.trim() || asset.name}</p>
          {asset.make?.trim() ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Make: {asset.make}</p> : null}
          {asset.model?.trim() && asset.name.trim() && asset.name.trim() !== asset.model.trim() ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Asset name: {asset.name}</p> : null}
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Scanned from a label QR code. This page is optimized for quick read-only identification in the field.</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <LookupField label="Asset tag" value={asset.assetTag} />
          <LookupField label="Make" value={asset.make?.trim() || "Not recorded"} />
          <LookupField label="Model" value={asset.model?.trim() || "Not recorded"} />
          <LookupField label="Asset name" value={asset.name} />
          <LookupField label="Serial number" value={asset.serialNumber?.trim() || "Not recorded"} />
          <LookupField label="Category" value={asset.category?.name ?? "Unassigned"} />
          <LookupField label="Current assignee" value={assigneeLabel} />
          <LookupField label="Location" value={asset.assignedLocation?.name ?? "Unassigned"} />
          <LookupField label="Status" value={asset.status?.name ?? "No status"} />
          <LookupField label="Lookup path" value={buildAssetLookupPath(asset.id)} />
        </section>
      </div>
    </main>
  );
}
