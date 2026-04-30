import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserAssetPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { AssetBulkEditCard } from "@/modules/assets/asset-bulk-edit-card";
import {
  ASSET_BULK_EDIT_HREF,
  normalizeAssetsReturnTo,
  parseAssetIdsParam,
} from "@/modules/assets/assets-routing";
import {
  bulkUpdateAssets,
  getAssetsByIds,
  listAssetReferenceData,
} from "@/modules/assets/asset.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type BulkEditAssetsPageProps = {
  searchParams?: Promise<{
    assetIds?: string | string[];
    returnTo?: string;
  }>;
};

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

async function bulkUpdateAssetsAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }
  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.bulkEditAssets || !permissionContext.capabilities.viewAssets) {
    redirect("/assets");
  }

  const returnTo = normalizeAssetsReturnTo(formData.get("returnTo")?.toString() ?? null);
  const assetIds = formData.getAll("assetIds").map((value) => value.toString());
  const selectedAssets = await getAssetsByIds(assetIds, { accessScope: permissionContext.assetScope });

  if (selectedAssets.length !== assetIds.length) {
    redirect(returnTo);
  }
  const applyMake = formData.get("applyMake")?.toString() === "true";
  const applyModel = formData.get("applyModel")?.toString() === "true";
  const applyCategory = formData.get("applyCategory")?.toString() === "true";
  const applyLocation = formData.get("applyLocation")?.toString() === "true";
  const applyScope = formData.get("applyScope")?.toString() === "true";

  await bulkUpdateAssets({
    assetIds,
    make: applyMake ? formData.get("make")?.toString() ?? "" : undefined,
    model: applyModel ? formData.get("model")?.toString() ?? "" : undefined,
    categoryId: applyCategory ? formData.get("categoryId")?.toString() ?? "" : undefined,
    assignedLocationId: applyLocation ? formData.get("assignedLocationId")?.toString() ?? "" : undefined,
    scopeId: applyScope ? formData.get("scopeId")?.toString() ?? "" : undefined,
    actorUserId: currentUser.id,
    accessScope: permissionContext.assetScope,
  });

  revalidatePath("/assets");
  revalidatePath(ASSET_BULK_EDIT_HREF);
  redirect(returnTo);
}

export default async function BulkEditAssetsPage({ searchParams }: BulkEditAssetsPageProps) {
  const params = (await searchParams) ?? {};
  const returnTo = normalizeAssetsReturnTo(params.returnTo ?? null);
  const selectedAssetIds = parseAssetIdsParam(params.assetIds);

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserAssetPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.capabilities.viewAssets || !permissionContext.capabilities.bulkEditAssets) {
    notFound();
  }

  if (selectedAssetIds.length === 0) {
    redirect(returnTo);
  }

  const [referenceData, selectedAssets] = await Promise.all([
    listAssetReferenceData(),
    getAssetsByIds(selectedAssetIds, { accessScope: permissionContext.assetScope }),
  ]);

  if (selectedAssets.length !== selectedAssetIds.length) {
    redirect(returnTo);
  }

  const categoryOptions = referenceData.categories.map((category) => ({
    id: category.id,
    label: buildTreeLabel(referenceData.categories, category.id) ?? category.name,
  })).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));

  const locationOptions = referenceData.locations.map((location) => ({
    id: location.id,
    label: buildTreeLabel(referenceData.locations, location.id) ?? location.name,
  })).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));

  const selectedAssetCards = selectedAssets.map((asset) => ({
    id: asset.id,
    assetTag: asset.assetTag,
    displayName: asset.model?.trim() || asset.name,
    make: asset.make,
    model: asset.model,
    categoryLabel: asset.category ? buildTreeLabel(referenceData.categories, asset.category.id) ?? asset.category.name : "Unassigned",
    locationLabel: asset.assignedLocation ? buildTreeLabel(referenceData.locations, asset.assignedLocation.id) ?? asset.assignedLocation.name : "Unassigned",
    scopeLabel: asset.scopes.length > 0 ? asset.scopes.map((scope) => scope.scope.name).join(", ") : "Unassigned",
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Assets</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Bulk edit assets</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
                Apply a tightly limited bulk update for Make, Model, Category, Location, and Department without mixing the workflow back into the main table page.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 xl:items-end">
              <Link href={returnTo}>
                <Button type="button" variant="ghost">Back to assets</Button>
              </Link>
              <div className="rounded-full bg-[#fff4e8] px-3 py-1 text-xs font-medium text-[#b56613] dark:bg-[rgba(246,150,41,0.16)] dark:text-[#ffd7ab]">
                {selectedAssetCards.length} selected
              </div>
            </div>
          </div>
        </PageHero>

        <AssetBulkEditCard
          action={bulkUpdateAssetsAction}
          cancelHref={returnTo}
          categoryOptions={categoryOptions}
          locationOptions={locationOptions}
          scopeOptions={referenceData.scopes.map((scope) => ({ id: scope.id, label: scope.name })).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }))}
          returnTo={returnTo}
          selectedAssets={selectedAssetCards}
        />
      </div>
    </AppShell>
  );
}
