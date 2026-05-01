import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserAssetPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";
import { buildAssetHref, buildAssetLabelHref, normalizeAssetsReturnTo } from "@/modules/assets/assets-routing";
import { AssetTransferPanel } from "@/modules/assets/asset-transfer-panel";
import {
  checkInAsset,
  checkOutAsset,
  getAssetAuditHistory,
  getAssetById,
  listAssetReferenceData,
} from "@/modules/assets/asset.service";
import { buildUserHref } from "@/modules/users/users-routing";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

const panelClass = "rounded-[32px] border border-[#ece7df] bg-white/92 p-6 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92 dark:shadow-[0_18px_40px_rgba(0,0,0,0.18)]";
const fieldClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-100 dark:focus:border-[#F69629]/70";
const subpanelClass = "rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)]";

type AssetViewPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams?: Promise<{ transfer?: string; returnTo?: string }>;
};

function formatDateTimeLabel(value?: Date | null) {
  return value ? value.toLocaleString() : "Not recorded";
}

function buildTreeLabel(items: Array<{ id: string; name: string; parentId: string | null }>, itemId: string | null | undefined) {
  if (!itemId) return null;

  const byId = new Map(items.map((item) => [item.id, item]));
  const labels: string[] = [];
  let current = byId.get(itemId) ?? null;

  while (current) {
    labels.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }

  return labels.join(" / ");
}

function buildScopeBadgeStyle(scope: { colorHex: string | null; colorMode: string | null }): CSSProperties {
  if (!scope.colorHex) return {};
  if (scope.colorMode === "fill") return { borderColor: `${scope.colorHex}55`, backgroundColor: `${scope.colorHex}14`, color: scope.colorHex };
  return { borderColor: scope.colorHex, color: scope.colorHex };
}

function parseTransferMode(value?: string) {
  return value === "checkin" || value === "checkout" ? value : null;
}

async function checkOutAssetAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.manageAssetTransfers) {
    redirect("/assets");
  }

  const assetId = formData.get("assetId")?.toString() ?? "";
  const returnTo = normalizeAssetsReturnTo(formData.get("returnTo")?.toString() ?? null);
  const asset = await getAssetById(assetId, { accessScope: permissionContext.assetScope });

  if (!asset) {
    redirect(returnTo);
  }

  await checkOutAsset({
    assetId,
    assignedUserId: formData.get("checkoutAssignedUserId")?.toString() ?? "",
    assignedLocationId: formData.get("checkoutLocationId")?.toString() ?? "",
    notes: formData.get("checkoutNote")?.toString() ?? "",
    actorUserId: currentUser.id,
    accessScope: permissionContext.assetScope,
  });

  redirect(buildAssetHref(assetId, { returnTo }));
}

async function checkInAssetAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.manageAssetTransfers) {
    redirect("/assets");
  }

  const assetId = formData.get("assetId")?.toString() ?? "";
  const returnTo = normalizeAssetsReturnTo(formData.get("returnTo")?.toString() ?? null);
  const asset = await getAssetById(assetId, { accessScope: permissionContext.assetScope });

  if (!asset) {
    redirect(returnTo);
  }

  await checkInAsset({
    assetId,
    locationId: formData.get("checkInLocationId")?.toString() ?? "",
    notes: formData.get("checkInNote")?.toString() ?? "",
    actorUserId: currentUser.id,
    accessScope: permissionContext.assetScope,
  });

  redirect(buildAssetHref(assetId, { returnTo }));
}

export default async function AssetViewPage({ params, searchParams }: AssetViewPageProps) {
  const { assetId } = await params;
  const search = (await searchParams) ?? {};
  const transferMode = parseTransferMode(search.transfer);
  const returnTo = normalizeAssetsReturnTo(search.returnTo ?? null);

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserAssetPermissionContext(),
  ]);
  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!permissionContext.capabilities.viewAssets) notFound();

  const [referenceData, asset] = await Promise.all([
    listAssetReferenceData(),
    getAssetById(assetId, { accessScope: permissionContext.assetScope }),
  ]);

  if (!asset) notFound();

  const history = await getAssetAuditHistory(assetId, undefined, { accessScope: permissionContext.assetScope });

  const recentHistory = history.slice(0, 3);

  return (
    <AppShell>
      <div className="space-y-6">
        <section className={panelClass}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Assets</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">View asset</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[#f0d3b4] bg-[#fff4e8] px-3 py-1 text-xs font-medium text-[#b56613] dark:border-[#6f5530] dark:bg-[rgba(246,150,41,0.16)] dark:text-[#ffd7ab]">{asset.assetTag}</span>
                {asset.status ? <AssetStatusPill color={asset.status.color} label={asset.status.name} /> : null}
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-xl font-semibold text-slate-950 dark:text-slate-100">{asset.model?.trim() || asset.name}</p>
                {asset.make?.trim() ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Make: {asset.make}</p>
                ) : null}
                {asset.model?.trim() && asset.name.trim() && asset.name.trim() !== asset.model.trim() ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Asset name: {asset.name}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {permissionContext.capabilities.printLabels ? (
                <Link href={buildAssetLabelHref(asset.id)}>
                  <Button type="button">Print label</Button>
                </Link>
              ) : null}
              {permissionContext.capabilities.editAssets ? (
                <Link href={buildAssetHref(asset.id, { section: "edit", returnTo })}>
                  <Button type="button" variant="secondary">Edit asset</Button>
                </Link>
              ) : null}
              <Link href={returnTo}>
                <Button type="button" variant="ghost">Back to assets</Button>
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          {permissionContext.capabilities.manageAssetTransfers ? (
            <AssetTransferPanel
              assetId={asset.id}
              cardClass={subpanelClass}
              checkInAction={checkInAssetAction}
              checkOutAction={checkOutAssetAction}
              fieldClass={fieldClass}
              filterState={{ q: "", statusId: null, categoryId: null, scopeId: null, locationId: null, userId: null, sort: "updated-desc" }}
              initialAssignedLocationId={asset.assignedLocationId}
              initialAssignedUserId={asset.assignedUserId}
              initialMode={transferMode}
              isCheckedOut={Boolean(asset.assignedUserId || asset.status?.key === "ASSIGNED")}
              locationLabel={asset.assignedLocation ? buildTreeLabel(referenceData.locations, asset.assignedLocation.id) ?? "No location" : "No location"}
              locations={referenceData.locations.map((location) => ({ id: location.id, label: buildTreeLabel(referenceData.locations, location.id) ?? location.name }))}
              returnTo={returnTo}
              statusColor={asset.status?.color ?? null}
              statusLabel={asset.status?.name ?? "No status"}
              userId={asset.assignedUser?.id ?? null}
              userLabel={asset.assignedUser?.name ?? "Nobody"}
              users={referenceData.users}
            />
          ) : (
            <section className={subpanelClass}>
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">Asset movement</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This role does not have check in / check out access.</p>
            </section>
          )}

          <section className={subpanelClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">Asset history</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Recent activity for this asset.</p>
              </div>
              <Link href={buildAssetHref(asset.id, { section: "history", returnTo })}>
                <Button type="button" variant="secondary">View more history</Button>
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {recentHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#ece7df] px-4 py-5 text-sm text-slate-500 dark:border-[#4b5255] dark:text-slate-400">No audit history has been recorded for this asset yet.</div>
              ) : (
                recentHistory.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.summary}</p>
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

        <section className={panelClass}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className={subpanelClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Make</p>
              <p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{asset.make?.trim() || "Not set"}</p>
            </div>
            <div className={subpanelClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Model</p>
              <p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{asset.model?.trim() || "Not set"}</p>
            </div>
            <div className={subpanelClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Asset name</p>
              <p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{asset.name}</p>
            </div>
            <div className={subpanelClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Category</p>
              <p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{buildTreeLabel(referenceData.categories, asset.categoryId) ?? "Unassigned"}</p>
            </div>
            <div className={subpanelClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Assigned user</p>
              <p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">
                {asset.assignedUser ? (
                  <Link className="text-[#b56613] underline-offset-4 transition hover:underline dark:text-[#ffd7ab]" href={buildUserHref(asset.assignedUser.id)}>
                    {asset.assignedUser.name}
                  </Link>
                ) : "Unassigned"}
              </p>
            </div>
            <div className={subpanelClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Location</p>
              <p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{asset.assignedLocation ? buildTreeLabel(referenceData.locations, asset.assignedLocation.id) : "Unassigned"}</p>
            </div>
            <div className={subpanelClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Serial number</p>
              <p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{asset.serialNumber ?? "Not set"}</p>
            </div>
          </div>

          {asset.scopes.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {asset.scopes.map(({ scope }) => (
                <span key={scope.id} className="rounded-full border px-2.5 py-1 text-xs font-medium" style={buildScopeBadgeStyle(scope)}>
                  {scope.name}
                </span>
              ))}
            </div>
          ) : null}

          {asset.notes ? (
            <div className="mt-5 rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#34393c]">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Notes</p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{asset.notes}</p>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
