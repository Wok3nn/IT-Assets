import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { HeaderAssetSearch } from "@/components/layout/header-asset-search";
import { InsetCard } from "@/components/layout/inset-card";
import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserAssetPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import {
  ASSET_PAGE_SIZE_OPTIONS,
  buildAssetsUrl,
  normalizeAssetsReturnTo,
  parseAssetsIncludeRetired,
  parseAssetsPage,
  parseAssetsPageSize,
  parseAssetsSort,
  type AssetPageSize,
} from "@/modules/assets/assets-routing";
import type { AssetListTransferState } from "@/modules/assets/asset-list-transfer-dialog";
import { checkInAsset, checkOutAsset, deleteAsset, getAssetById, listAssetReferenceData, listAssets } from "@/modules/assets/asset.service";
import { AssetsFilterPanel } from "@/modules/assets/components/assets-filter-panel";
import { AssetsIncludeRetiredPreference } from "@/modules/assets/components/assets-include-retired-preference";
import { readSetupState } from "@/services/setup-state";

import { AssetsGrid, type AssetGridRow } from "./assets-grid";

export const dynamic = "force-dynamic";

type AssetsPageProps = {
  searchParams?: Promise<{
    q?: string;
    statusId?: string;
    categoryId?: string;
    scopeId?: string;
    locationId?: string;
    userId?: string;
    includeRetired?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const fieldClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-100 dark:focus:border-[#F69629]/70";

function buildTreeLabel(items: Array<{ id: string; name: string; parentId: string | null }>, itemId: string | null | undefined) {
  if (!itemId) {
    return null;
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const labels: string[] = [];
  let current = byId.get(itemId) ?? null;

  while (current) {
    labels.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }

  return labels.join(" / ");
}

function formatDateLabel(value: Date | null | undefined) {
  return value ? value.toLocaleDateString() : "Not set";
}

function getPaginationWindow(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(page - 1, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function getNextSort(currentSort: ReturnType<typeof parseAssetsSort>, column: "assetTag" | "assetModel") {
  if (column === "assetTag") {
    if (currentSort === "tag-asc") return "tag-desc" as const;
    if (currentSort === "tag-desc") return "updated-desc" as const;
    return "tag-asc" as const;
  }

  if (currentSort === "model-asc") return "model-desc" as const;
  if (currentSort === "model-desc") return "updated-desc" as const;
  return "model-asc" as const;
}

function getSortDirection(currentSort: ReturnType<typeof parseAssetsSort>, column: "assetTag" | "assetModel") {
  if (column === "assetTag") {
    if (currentSort === "tag-asc") return "asc" as const;
    if (currentSort === "tag-desc") return "desc" as const;
    return null;
  }

  if (currentSort === "model-asc") return "asc" as const;
  if (currentSort === "model-desc") return "desc" as const;
  return null;
}

function sortByLabel<T extends { label: string }>(items: T[]) {
  return [...items].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

async function deleteAssetAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.deleteAssets) {
    redirect("/assets");
  }

  const assetId = formData.get("assetId")?.toString() ?? "";
  const returnTo = normalizeAssetsReturnTo(formData.get("returnTo")?.toString() ?? null);
  const asset = await getAssetById(assetId, { accessScope: permissionContext.assetScope });

  if (!asset) {
    redirect(returnTo);
  }

  await deleteAsset(assetId, currentUser.id, permissionContext.assetScope);
  revalidatePath("/assets");
  redirect(returnTo);
}

async function transferAssetFromListAction(
  _state: AssetListTransferState,
  formData: FormData,
): Promise<AssetListTransferState> {
  "use server";

  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.manageAssetTransfers) {
    return {
      ok: false,
      message: "You do not have permission to check assets in or out.",
    };
  }

  const assetId = String(formData.get("assetId") ?? "").trim();
  const mode = String(formData.get("mode") ?? "").trim();
  const notes = String(formData.get("transferNote") ?? "");

  if (mode !== "checkout" && mode !== "checkin") {
    return {
      ok: false,
      message: "Choose a valid asset movement.",
    };
  }

  const asset = await getAssetById(assetId, { accessScope: permissionContext.assetScope });

  if (!asset) {
    return {
      ok: false,
      mode,
      message: "Asset was not found or is no longer available.",
    };
  }

  try {
    if (mode === "checkout") {
      await checkOutAsset({
        assetId,
        assignedUserId: String(formData.get("assignedUserId") ?? ""),
        notes,
        actorUserId: currentUser.id,
        accessScope: permissionContext.assetScope,
      });
    } else {
      await checkInAsset({
        assetId,
        locationId: String(formData.get("locationId") ?? ""),
        notes,
        actorUserId: currentUser.id,
        accessScope: permissionContext.assetScope,
      });
    }
  } catch (error) {
    return {
      ok: false,
      mode,
      message: error instanceof Error ? error.message : "Asset movement could not be saved.",
    };
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/assets/${assetId}/history`);

  return {
    ok: true,
    mode,
    message: mode === "checkout" ? "Asset checked out." : "Asset checked in.",
  };
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const params = (await searchParams) ?? {};
  const searchQuery = params.q?.trim() ?? "";
  const statusId = params.statusId?.trim() || null;
  const categoryId = params.categoryId?.trim() || null;
  const scopeId = params.scopeId?.trim() || null;
  const locationId = params.locationId?.trim() || null;
  const userId = params.userId?.trim() || null;
  const includeRetired = parseAssetsIncludeRetired(params.includeRetired);
  const hasIncludeRetiredParam = typeof params.includeRetired === "string";
  const sort = parseAssetsSort(params.sort);
  const page = parseAssetsPage(params.page);
  const pageSize = parseAssetsPageSize(params.pageSize);

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserAssetPermissionContext(),
  ]);
  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!permissionContext.capabilities.viewAssets) notFound();

  const [assetResults, referenceData] = await Promise.all([
    listAssets({
      q: searchQuery,
      statusId,
      categoryId,
      scopeId,
      locationId,
      userId,
      includeRetired,
      sort,
      page,
      pageSize,
      accessScope: permissionContext.assetScope,
    }),
    listAssetReferenceData(),
  ]);

  const categoryOptions = sortByLabel(referenceData.categories.map((category) => ({
    ...category,
    label: buildTreeLabel(referenceData.categories, category.id) ?? category.name,
  })));
  const locationOptions = sortByLabel(referenceData.locations.map((location) => ({
    ...location,
    label: buildTreeLabel(referenceData.locations, location.id) ?? location.name,
  })));
  const scopeOptions = sortByLabel(referenceData.scopes.map((scope) => ({
    ...scope,
    label: scope.name,
  })));
  const userOptions = sortByLabel(referenceData.users.map((user) => ({
    ...user,
    label: user.name,
  })));
  const statusOptions = sortByLabel(referenceData.statuses.map((status) => ({
    ...status,
    label: status.name,
  })));

  const { items: assets, totalCount, assignedCount, maintenanceCount, totalPages, page: currentPage } = assetResults;
  const returnTo = buildAssetsUrl({ q: searchQuery || null, statusId, categoryId, scopeId, locationId, userId, includeRetired, sort, page: currentPage, pageSize });
  const assetGridRows: AssetGridRow[] = assets.map((asset) => ({
    id: asset.id,
    assetTag: asset.assetTag?.trim() || "Not set",
    assetName: asset.name,
    make: asset.make,
    model: asset.model,
    status: asset.status
      ? {
          label: asset.status.name,
          color: asset.status.color,
        }
      : null,
    userId: asset.assignedUser?.id ?? null,
    user: asset.assignedUser?.name ?? "Unassigned",
    serialNumber: asset.serialNumber?.trim() || null,
    comments: asset.notes?.trim() || null,
    category: asset.category ? buildTreeLabel(referenceData.categories, asset.category.id) ?? asset.category.name : "Unassigned",
    location: asset.assignedLocation ? buildTreeLabel(referenceData.locations, asset.assignedLocation.id) ?? asset.assignedLocation.name : "Unassigned",
    purchaseDate: formatDateLabel(asset.purchaseDate),
    warrantyExpiry: formatDateLabel(asset.warrantyExpiry),
    checkLabel: asset.assignedUser || asset.assignedLocation || asset.status?.key === "ASSIGNED" ? "Check in" : "Check out",
  }));
  const visibleRangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const visibleRangeEnd = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount);
  const paginationWindow = getPaginationWindow(currentPage, totalPages);
  const sharedQuery = {
    q: searchQuery || null,
    statusId,
    categoryId,
    scopeId,
    locationId,
    userId,
    includeRetired,
    sort,
    pageSize: pageSize as AssetPageSize,
  };
  const retiredToggleHref = buildAssetsUrl({
    ...sharedQuery,
    includeRetired: !includeRetired,
    page: 1,
  });
  const activeFilterCount = [statusId, categoryId, scopeId, locationId, userId].filter(Boolean).length;
  const headerSorts = {
    assetTag: {
      href: buildAssetsUrl({ ...sharedQuery, sort: getNextSort(sort, "assetTag"), page: 1 }),
      label: sort === "tag-asc" ? "Sort Asset Tag descending" : sort === "tag-desc" ? "Clear Asset Tag sort" : "Sort Asset Tag ascending",
      direction: getSortDirection(sort, "assetTag"),
    },
    assetModel: {
      href: buildAssetsUrl({ ...sharedQuery, sort: getNextSort(sort, "assetModel"), page: 1 }),
      label: sort === "model-asc" ? "Sort Model descending" : sort === "model-desc" ? "Clear Model sort" : "Sort Model ascending",
      direction: getSortDirection(sort, "assetModel"),
    },
  } as const;

  return (
    <AppShell>
      <AssetsIncludeRetiredPreference hasIncludeRetiredParam={hasIncludeRetiredParam} includeRetired={includeRetired} />
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Assets</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Track every device in one place</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">Use a compact list to browse assets, open row-level actions, or select multiple assets for a dedicated bulk edit flow.</p>
            </div>
            <div className="flex w-full min-w-0 max-w-[760px] flex-col gap-3 xl:flex-none">
              <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-end">
                <HeaderAssetSearch
                  className="min-w-0 flex-1"
                  compact
                  defaultValue={searchQuery}
                  hiddenFields={{
                    statusId,
                    categoryId,
                    scopeId,
                    locationId,
                    userId,
                    includeRetired,
                    sort,
                    pageSize,
                  }}
                />
                <Link
                  aria-checked={includeRetired}
                  aria-label={includeRetired ? "Hide retired assets" : "Include retired assets"}
                  className="inline-flex h-11 flex-none items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/92 px-4 text-sm text-slate-600 transition hover:border-[#F69629]/45 hover:text-slate-900 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-300 dark:hover:border-[#F69629]/55 dark:hover:text-slate-100"
                  href={retiredToggleHref}
                  role="switch"
                >
                  <span className="whitespace-nowrap text-xs font-medium tracking-[0.02em] text-slate-500 dark:text-slate-400">Include retired</span>
                  <span
                    aria-hidden="true"
                    className={`relative block h-[1.6rem] w-11 rounded-full border transition-all duration-150 ${includeRetired
                      ? "border-[#f69629] bg-[linear-gradient(135deg,#f8a84d_0%,#f69629_100%)] shadow-[0_0_0_4px_rgba(246,150,41,0.12)] dark:border-[#f69629] dark:bg-[linear-gradient(135deg,#ffb35a_0%,#f69629_100%)]"
                      : "border-[#d7dee7] bg-[linear-gradient(180deg,#eef2f7_0%,#e2e8f0_100%)] dark:border-[#5b6468] dark:bg-[linear-gradient(180deg,#3c4347_0%,#2f3437_100%)]"}`}
                  >
                    <span
                      className={`absolute top-[1px] h-5 w-5 rounded-full bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_2px_6px_rgba(15,23,42,0.18)] transition-transform duration-150 dark:bg-[linear-gradient(180deg,#f8fafc_0%,#dfe5ec_100%)] ${includeRetired ? "translate-x-[1.15rem]" : "translate-x-0"}`}
                      style={{ left: "1px" }}
                    />
                  </span>
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["Filtered assets", totalCount],
                  ["Assigned", assignedCount],
                  ["Maintenance", maintenanceCount],
                ].map(([label, value]) => (
                  <InsetCard key={label} className="rounded-[24px] px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100">{value}</p>
                  </InsetCard>
                ))}
              </div>
            </div>
          </div>
        </PageHero>

        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Asset directory</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Showing {visibleRangeStart}-{visibleRangeEnd} of {totalCount} filtered asset{totalCount === 1 ? "" : "s"}. Click a row to reveal actions, or use the checkbox column to send selected assets into the dedicated bulk edit screen.</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Retired assets stay hidden by default in this operational view. Turn them on from the header toggle when you need the full inventory.</p>
            </div>
            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[220px] xl:flex-row xl:items-center xl:justify-end">
              {permissionContext.capabilities.createAssets ? (
                <Link href="/assets/new">
                  <Button className="whitespace-nowrap" type="button">New asset</Button>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <AssetsFilterPanel activeFilterCount={activeFilterCount}>
              <form
                action="/assets"
                className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_180px_auto]"
                id="asset-filters"
              >
                <input name="q" type="hidden" value={searchQuery} />
                <input name="sort" type="hidden" value={sort} />
                {includeRetired ? <input name="includeRetired" type="hidden" value="true" /> : null}
                <select defaultValue={statusId ?? ""} name="statusId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select>
                <select defaultValue={categoryId ?? ""} name="categoryId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">All categories</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select>
                <select defaultValue={scopeId ?? ""} name="scopeId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">All departments</option>{scopeOptions.map((scope) => <option key={scope.id} value={scope.id}>{scope.label}</option>)}</select>
                <select defaultValue={locationId ?? ""} name="locationId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">All locations</option>{locationOptions.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</select>
                <select defaultValue={userId ?? ""} name="userId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">Any assignee</option>{userOptions.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}</select>
                <select defaultValue={String(pageSize)} name="pageSize" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}>
                  {ASSET_PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option} per page</option>)}
                </select>
                <div className="flex items-center gap-3 xl:justify-end">
                  <Button className="whitespace-nowrap" type="submit">Apply filters</Button>
                  <Link href="/assets"><Button className="whitespace-nowrap" type="button" variant="ghost">Reset</Button></Link>
                </div>
              </form>
            </AssetsFilterPanel>

            <AssetsGrid
              activeSort={sort}
              canBulkEditAssets={permissionContext.capabilities.bulkEditAssets}
              canDeleteAssets={permissionContext.capabilities.deleteAssets}
              canManageAssetTransfers={permissionContext.capabilities.manageAssetTransfers}
              canPrintLabels={permissionContext.capabilities.printLabels}
              deleteAction={deleteAssetAction}
              headerSorts={headerSorts}
              locations={locationOptions}
              returnTo={returnTo}
              rows={assetGridRows}
              transferAction={transferAssetFromListAction}
              users={userOptions}
            />

            <div className="flex flex-col gap-3 rounded-[26px] border border-[#d7dde4] bg-white/80 px-4 py-3 dark:border-[#556068] dark:bg-[#2c3134] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-300">Showing <span className="font-medium text-slate-950 dark:text-slate-100">{visibleRangeStart}-{visibleRangeEnd}</span> of <span className="font-medium text-slate-950 dark:text-slate-100">{totalCount}</span> assets.</p>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Link href={buildAssetsUrl({ ...sharedQuery, page: Math.max(1, currentPage - 1) })} aria-disabled={currentPage === 1} className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}>
                  <Button type="button" variant="ghost">Previous</Button>
                </Link>
                {paginationWindow.map((pageNumber) => (
                  <Link key={pageNumber} href={buildAssetsUrl({ ...sharedQuery, page: pageNumber })}>
                    <Button type="button" variant={pageNumber === currentPage ? "primary" : "ghost"}>{pageNumber}</Button>
                  </Link>
                ))}
                <Link href={buildAssetsUrl({ ...sharedQuery, page: Math.min(totalPages, currentPage + 1) })} aria-disabled={currentPage === totalPages} className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}>
                  <Button type="button" variant="ghost">Next</Button>
                </Link>
              </div>
            </div>
          </div>
        </PageHero>
      </div>
    </AppShell>
  );
}
