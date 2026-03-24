import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { InsetCard } from "@/components/layout/inset-card";
import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { buildAssetsUrl, normalizeAssetsReturnTo, parseAssetsSort } from "@/modules/assets/assets-routing";
import { deleteAsset, listAssetReferenceData, listAssets } from "@/modules/assets/asset.service";

import { AssetsGrid, type AssetGridRow } from "./assets-grid";
import { readSetupState } from "@/services/setup-state";

type AssetsPageProps = {
  searchParams?: Promise<{
    q?: string;
    statusId?: string;
    categoryId?: string;
    scopeId?: string;
    locationId?: string;
    userId?: string;
    sort?: string;
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

async function deleteAssetAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const assetId = formData.get("assetId")?.toString() ?? "";
  const returnTo = normalizeAssetsReturnTo(formData.get("returnTo")?.toString() ?? null);

  await deleteAsset(assetId, currentUser.id);
  revalidatePath("/assets");
  redirect(returnTo);
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const params = (await searchParams) ?? {};
  const searchQuery = params.q?.trim() ?? "";
  const statusId = params.statusId?.trim() || null;
  const categoryId = params.categoryId?.trim() || null;
  const scopeId = params.scopeId?.trim() || null;
  const locationId = params.locationId?.trim() || null;
  const userId = params.userId?.trim() || null;
  const sort = parseAssetsSort(params.sort);

  const [setupState, currentUser] = await Promise.all([readSetupState(), getCurrentUser()]);
  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");

  const [assets, referenceData] = await Promise.all([
    listAssets({ q: searchQuery, statusId, categoryId, scopeId, locationId, userId, sort }),
    listAssetReferenceData(),
  ]);

  const assignedCount = assets.filter((asset) => asset.assignedUser || asset.assignedLocation).length;
  const maintenanceCount = assets.filter((asset) => asset.status?.key === "MAINTENANCE").length;
  const returnTo = buildAssetsUrl({ q: searchQuery || null, statusId, categoryId, scopeId, locationId, userId, sort });
  const assetGridRows: AssetGridRow[] = assets.map((asset) => ({
    id: asset.id,
    assetTag: asset.assetTag?.trim() || "Not set",
    assetName: asset.name,
    status: asset.status
      ? {
          label: asset.status.name,
          color: asset.status.color,
        }
      : null,
    user: asset.assignedUser?.name ?? asset.assignedLocation?.name ?? "Unassigned",
    serialNumber: asset.serialNumber?.trim() || "Not set",
    checkLabel: asset.assignedUser || asset.assignedLocation || asset.status?.key === "ASSIGNED" ? "Check in" : "Check out",
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Assets</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Track every device in one place</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">Use a compact list to select an asset, open its view page, or jump directly into the correct transfer action.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
              {[
                ["Filtered assets", assets.length],
                ["Assigned", assignedCount],
                ["Maintenance", maintenanceCount],
              ].map(([label, value]) => (
                <InsetCard key={label}>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">{value}</p>
                </InsetCard>
              ))}
            </div>
          </div>
        </PageHero>

        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Asset directory</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{assets.length} asset{assets.length === 1 ? "" : "s"} matched the current filters. Click a row to reveal actions, then open the asset view, transfer workflow, or delete confirmation.</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The directory uses the rebuilt grid implementation with resizing, the pinned Actions column, and the current asset detail workflow.</p>
            </div>
            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[460px] xl:flex-row xl:items-center xl:justify-end">
              <input defaultValue={searchQuery} className={`${fieldClass} xl:min-w-[320px]`} form="asset-filters" name="q" placeholder="Search by name, asset tag, or serial number" type="search" />
              <Link href="/assets/new">
                <Button className="whitespace-nowrap" type="button">New asset</Button>
              </Link>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <form
              action="/assets"
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
              id="asset-filters"
            >
              <select defaultValue={statusId ?? ""} name="statusId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">All statuses</option>{referenceData.statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select>
              <select defaultValue={categoryId ?? ""} name="categoryId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">All categories</option>{referenceData.categories.map((category) => <option key={category.id} value={category.id}>{buildTreeLabel(referenceData.categories, category.id)}</option>)}</select>
              <select defaultValue={scopeId ?? ""} name="scopeId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">All departments</option>{referenceData.scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}</select>
              <select defaultValue={locationId ?? ""} name="locationId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">All locations</option>{referenceData.locations.map((location) => <option key={location.id} value={location.id}>{buildTreeLabel(referenceData.locations, location.id)}</option>)}</select>
              <select defaultValue={userId ?? ""} name="userId" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="">Any assignee</option>{referenceData.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
              <select defaultValue={sort} name="sort" className={`${fieldClass} min-w-0 px-3 py-2.5 text-xs`}><option value="updated-desc">Recently updated</option><option value="name-asc">Name A-Z</option><option value="tag-asc">Tag A-Z</option><option value="purchase-desc">Newest purchase</option></select>
              <div className="flex items-center gap-3 xl:justify-end">
                <Button className="whitespace-nowrap" type="submit">Apply filters</Button>
                <Link href="/assets"><Button className="whitespace-nowrap" type="button" variant="ghost">Reset</Button></Link>
              </div>
            </form>

            <AssetsGrid deleteAction={deleteAssetAction} returnTo={returnTo} rows={assetGridRows} />
          </div>
        </PageHero>
      </div>
    </AppShell>
  );
}
