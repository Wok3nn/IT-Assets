import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserAssetPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { AssetForm } from "@/modules/assets/asset-form";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";
import { buildAssetHref, normalizeAssetsReturnTo } from "@/modules/assets/assets-routing";
import {
  getAssetById,
  listAssetReferenceData,
  updateAsset,
} from "@/modules/assets/asset.service";
import { readSetupState } from "@/services/setup-state";

type EditAssetPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
};

function formatDateInput(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
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

async function updateAssetAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.editAssets) {
    redirect("/assets");
  }

  const assetId = formData.get("assetId")?.toString() ?? "";
  const returnTo = normalizeAssetsReturnTo(formData.get("returnTo")?.toString() ?? null);
  const asset = await getAssetById(assetId, { accessScope: permissionContext.assetScope });

  if (!asset) {
    redirect(returnTo);
  }

  await updateAsset({
    assetId,
    name: formData.get("name")?.toString() ?? "",
    make: formData.get("make")?.toString() ?? "",
    model: formData.get("model")?.toString() ?? "",
    assetTag: formData.get("assetTag")?.toString() ?? "",
    serialNumber: formData.get("serialNumber")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    purchaseDate: formData.get("purchaseDate")?.toString() ?? "",
    warrantyExpiry: formData.get("warrantyExpiry")?.toString() ?? "",
    categoryId: formData.get("categoryId")?.toString() ?? "",
    statusId: formData.get("statusId")?.toString() ?? "",
    assignedUserId: formData.get("assignedUserId")?.toString() ?? "",
    assignedLocationId: formData.get("assignedLocationId")?.toString() ?? "",
    scopeIds: formData.getAll("scopeIds").map((value) => value.toString()),
    actorUserId: currentUser.id,
    accessScope: permissionContext.assetScope,
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/assets/${assetId}/edit`);
  revalidatePath(`/assets/${assetId}/history`);
  redirect(buildAssetHref(assetId, { section: "edit", returnTo }));
}

export default async function EditAssetPage({ params, searchParams }: EditAssetPageProps) {
  const { assetId } = await params;
  const returnTo = normalizeAssetsReturnTo((await searchParams)?.returnTo ?? null);

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserAssetPermissionContext(),
  ]);
  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!permissionContext.capabilities.editAssets) notFound();

  const [referenceData, asset] = await Promise.all([
    listAssetReferenceData(),
    getAssetById(assetId, { accessScope: permissionContext.assetScope }),
  ]);

  if (!asset) notFound();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Assets</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Edit asset</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[#f0d3b4] bg-[#fff4e8] px-3 py-1 text-xs font-medium text-[#b56613] dark:border-[#6f5530] dark:bg-[rgba(246,150,41,0.16)] dark:text-[#ffd7ab]">{asset.assetTag}</span>
                {asset.status ? <AssetStatusPill color={asset.status.color} label={asset.status.name} /> : null}
              </div>
            </div>
            <div className="flex gap-3">
              <Link href={buildAssetHref(asset.id, { returnTo })}>
                <Button type="button" variant="secondary">Back to view</Button>
              </Link>
              <Link href={returnTo}>
                <Button type="button" variant="ghost">Back to assets</Button>
              </Link>
            </div>
          </div>
        </PageHero>

        <PageHero>
          <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span>Category {buildTreeLabel(referenceData.categories, asset.categoryId) ?? "Unassigned"}</span>
            <span>Location {asset.assignedLocation ? buildTreeLabel(referenceData.locations, asset.assignedLocation.id) : "Unassigned"}</span>
            <span>User {asset.assignedUser?.name ?? "Unassigned"}</span>
          </div>

          <AssetForm
            action={updateAssetAction}
            categories={referenceData.categories}
            hiddenFields={<><input name="assetId" type="hidden" value={asset.id} /><input name="returnTo" type="hidden" value={returnTo} /></>}
            initialValue={{
              id: asset.id,
              name: asset.name,
              make: asset.make,
              model: asset.model,
              assetTag: asset.assetTag,
              serialNumber: asset.serialNumber,
              notes: asset.notes,
              purchaseDate: formatDateInput(asset.purchaseDate),
              warrantyExpiry: formatDateInput(asset.warrantyExpiry),
              categoryId: asset.categoryId,
              statusId: asset.statusId,
              assignedUserId: asset.assignedUserId,
              assignedLocationId: asset.assignedLocationId,
              scopeIds: asset.scopes.map((scope) => scope.scopeId),
            }}
            locations={referenceData.locations}
            mode="edit"
            scopes={referenceData.scopes}
            statuses={referenceData.statuses}
            submitLabel="Save asset"
            users={referenceData.users}
          />
        </PageHero>
      </div>
    </AppShell>
  );
}




