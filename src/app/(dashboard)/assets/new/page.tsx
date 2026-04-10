import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserAssetPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { AssetForm } from "@/modules/assets/asset-form";
import { buildAssetsUrl, parseAssetsPage, parseAssetsPageSize, parseAssetsSort } from "@/modules/assets/assets-routing";
import { createAsset, getAssetById, listAssetReferenceData } from "@/modules/assets/asset.service";
import { readSetupState } from "@/services/setup-state";

type NewAssetPageProps = {
  searchParams?: Promise<{
    duplicateId?: string;
    q?: string;
    statusId?: string;
    categoryId?: string;
    scopeId?: string;
    locationId?: string;
    userId?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function hiddenFilterFields(input: { q: string; statusId: string | null; categoryId: string | null; scopeId: string | null; locationId: string | null; userId: string | null; sort: ReturnType<typeof parseAssetsSort>; page: number; pageSize: number; }) {
  return (
    <>
      <input name="q" type="hidden" value={input.q} />
      <input name="statusIdFilter" type="hidden" value={input.statusId ?? ""} />
      <input name="categoryIdFilter" type="hidden" value={input.categoryId ?? ""} />
      <input name="scopeIdFilter" type="hidden" value={input.scopeId ?? ""} />
      <input name="locationIdFilter" type="hidden" value={input.locationId ?? ""} />
      <input name="userIdFilter" type="hidden" value={input.userId ?? ""} />
      <input name="sort" type="hidden" value={input.sort} />
      <input name="page" type="hidden" value={String(input.page)} />
      <input name="pageSize" type="hidden" value={String(input.pageSize)} />
    </>
  );
}

async function createAssetAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.createAssets) {
    redirect("/assets");
  }

  await createAsset({
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
  });
  revalidatePath("/assets");
  revalidatePath("/assets/new");
  redirect(buildAssetsUrl({
    q: formData.get("q")?.toString() || null,
    statusId: formData.get("statusIdFilter")?.toString() || null,
    categoryId: formData.get("categoryIdFilter")?.toString() || null,
    scopeId: formData.get("scopeIdFilter")?.toString() || null,
    locationId: formData.get("locationIdFilter")?.toString() || null,
    userId: formData.get("userIdFilter")?.toString() || null,
    sort: parseAssetsSort(formData.get("sort")?.toString()),
    page: parseAssetsPage(formData.get("page")?.toString()),
    pageSize: parseAssetsPageSize(formData.get("pageSize")?.toString()),
  }));
}

export default async function NewAssetPage({ searchParams }: NewAssetPageProps) {
  const params = (await searchParams) ?? {};
  const searchQuery = params.q?.trim() ?? "";
  const statusId = params.statusId?.trim() || null;
  const categoryId = params.categoryId?.trim() || null;
  const scopeId = params.scopeId?.trim() || null;
  const locationId = params.locationId?.trim() || null;
  const userId = params.userId?.trim() || null;
  const sort = parseAssetsSort(params.sort);
  const page = parseAssetsPage(params.page);
  const pageSize = parseAssetsPageSize(params.pageSize);
  const duplicateId = params.duplicateId?.trim() || null;

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserAssetPermissionContext(),
  ]);
  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!permissionContext.capabilities.createAssets) notFound();

  const [referenceData, duplicateAsset] = await Promise.all([
    listAssetReferenceData(),
    duplicateId ? getAssetById(duplicateId, { accessScope: permissionContext.assetScope }) : Promise.resolve(null),
  ]);

  const backHref = buildAssetsUrl({ q: searchQuery || null, statusId, categoryId, scopeId, locationId, userId, sort, page, pageSize });
  const initialValue = duplicateAsset
    ? {
        name: duplicateAsset.name,
        make: duplicateAsset.make,
        model: duplicateAsset.model,
        categoryId: duplicateAsset.categoryId,
      }
    : undefined;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Assets</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{duplicateAsset ? "Duplicate asset" : "New asset"}</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
                {duplicateAsset
                  ? "The category path and core identity fields were copied from the selected asset. Finish the remaining details and a new asset tag will be assigned automatically."
                  : "Create a new asset with category, model, make, optional name, and the next available asset tag."}
              </p>
            </div>
            <Link href={backHref}>
              <Button type="button" variant="ghost">Back to assets</Button>
            </Link>
          </div>
        </PageHero>

        <PageHero>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">{duplicateAsset ? "New asset from template" : "Asset details"}</h2>
            {duplicateAsset ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Source asset: {duplicateAsset.assetTag} {duplicateAsset.name ? `- ${duplicateAsset.name}` : ""}
              </p>
            ) : null}
          </div>
          <AssetForm
            action={createAssetAction}
            categories={referenceData.categories}
            defaultAssetTag={referenceData.suggestedAssetTag}
            hiddenFields={hiddenFilterFields({ q: searchQuery, statusId, categoryId, scopeId, locationId, userId, sort, page, pageSize })}
            initialValue={initialValue}
            locations={referenceData.locations}
            mode="create"
            scopes={referenceData.scopes}
            statuses={referenceData.statuses}
            submitLabel={duplicateAsset ? "Create duplicated asset" : "Create asset"}
            users={referenceData.users}
          />
        </PageHero>
      </div>
    </AppShell>
  );
}
