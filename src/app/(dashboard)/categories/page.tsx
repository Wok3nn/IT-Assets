import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminSectionHeader } from "@/components/admin/admin-section-header";
import { buildColorCardStyle } from "@/components/admin/card-style";
import { HeaderAssetSearch } from "@/components/layout/header-asset-search";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { buildAssetsUrl } from "@/modules/assets/assets-routing";
import {
  deleteCategory,
  getCategoryById,
  listChildCategories,
  listTopLevelCategories,
} from "@/modules/categories/category.service";
import { readSetupState } from "@/services/setup-state";

type CategoriesPageProps = {
  searchParams?: Promise<{
    parentId?: string;
  }>;
};

function buildCategoryUrl(parentId: string | null) {
  const params = new URLSearchParams();

  if (parentId) {
    params.set("parentId", parentId);
  }

  const query = params.toString();
  return query ? `/categories?${query}` : "/categories";
}

const categoryCardActionClassName = "w-full justify-center rounded-2xl border border-slate-200/90 bg-slate-100/88 text-slate-500 ring-1 ring-transparent transition-[color,border-color,background-color,box-shadow] duration-150 group-hover:border-[#F69629]/35 group-hover:bg-[rgba(246,150,41,0.12)] group-hover:text-[#b56613] group-hover:ring-[#F69629]/18 hover:border-[#F69629]/55 hover:bg-[rgba(246,150,41,0.2)] hover:text-[#9f580f] hover:shadow-[0_10px_20px_rgba(246,150,41,0.18)] dark:border-[#4f565a] dark:bg-[#34393c] dark:text-slate-300 dark:group-hover:border-[#F69629]/45 dark:group-hover:bg-[rgba(246,150,41,0.16)] dark:group-hover:text-[#ffd1a0] dark:group-hover:ring-[#F69629]/18 dark:hover:border-[#F69629]/75 dark:hover:bg-[rgba(246,150,41,0.26)] dark:hover:text-[#fff0dd] dark:hover:shadow-[0_14px_24px_rgba(0,0,0,0.24)]";
const categoryCardDangerActionClassName = "w-full justify-center rounded-2xl border border-slate-200/90 bg-slate-100/88 text-slate-500 ring-1 ring-transparent transition-[color,border-color,background-color,box-shadow] duration-150 group-hover:border-red-300 group-hover:bg-red-100 group-hover:text-red-700 group-hover:ring-red-200/80 hover:border-red-400 hover:bg-red-200 hover:text-red-800 hover:shadow-[0_10px_20px_rgba(220,38,38,0.14)] dark:border-[#4f565a] dark:bg-[#34393c] dark:text-slate-300 dark:group-hover:border-red-400/70 dark:group-hover:bg-[rgba(220,38,38,0.28)] dark:group-hover:text-red-100 dark:group-hover:ring-red-400/30 dark:hover:border-red-300 dark:hover:bg-[rgba(220,38,38,0.4)] dark:hover:text-white dark:hover:shadow-[0_14px_24px_rgba(0,0,0,0.28)]";
const categoryCardStatusClassName = "w-full justify-center rounded-2xl border border-slate-200/90 bg-slate-100/88 text-slate-500 ring-1 ring-transparent transition-[color,border-color,background-color,box-shadow] duration-150 group-hover:border-emerald-300 group-hover:bg-emerald-100 group-hover:text-emerald-800 group-hover:ring-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-200 hover:text-emerald-900 hover:shadow-[0_10px_20px_rgba(16,185,129,0.14)] dark:border-[#4f565a] dark:bg-[#34393c] dark:text-slate-300 dark:group-hover:border-emerald-400/60 dark:group-hover:bg-[rgba(16,185,129,0.24)] dark:group-hover:text-emerald-100 dark:group-hover:ring-emerald-400/25 dark:hover:border-emerald-300 dark:hover:bg-[rgba(16,185,129,0.34)] dark:hover:text-white dark:hover:shadow-[0_14px_24px_rgba(0,0,0,0.28)]";

function buildNewCategoryUrl(parentId: string | null) {
  if (!parentId) {
    return "/categories/new";
  }

  return `/categories/new?parentId=${parentId}`;
}

async function deleteCategoryAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserPermissionContext();

  if (!permissionContext.capabilities.editCategories) {
    redirect("/categories");
  }

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const parentIdValue = String(formData.get("parentId") ?? "").trim();

  if (!categoryId) {
    return;
  }

  await deleteCategory(categoryId);
  revalidatePath("/categories");

  if (parentIdValue) {
    redirect(buildCategoryUrl(parentIdValue));
  }
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedParentId = resolvedSearchParams?.parentId?.trim() || null;

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.capabilities.viewCategories) {
    redirect("/dashboard");
  }

  const [topLevelCategories, selectedParent] = await Promise.all([
    listTopLevelCategories(),
    selectedParentId ? getCategoryById(selectedParentId) : Promise.resolve(null),
  ]);

  if (selectedParentId && !selectedParent) {
    redirect("/categories");
  }

  const childCategories = selectedParent ? await listChildCategories(selectedParent.id) : [];
  const categoriesToRender = selectedParent ? childCategories : topLevelCategories;
  const heading = selectedParent ? `${selectedParent.name} children` : "Parent categories";
  const summary = selectedParent
    ? childCategories.length === 0
      ? `No child categories exist under ${selectedParent.name} yet.`
      : `${childCategories.length} child categor${childCategories.length === 1 ? "y" : "ies"} under ${selectedParent.name}.`
    : topLevelCategories.length === 0
      ? "No categories yet. Create the first parent category to start organizing assets."
      : `${topLevelCategories.length} parent categor${topLevelCategories.length === 1 ? "y" : "ies"} available.`;
  const backHref = selectedParent?.parent?.id
    ? buildCategoryUrl(selectedParent.parent.id)
    : buildCategoryUrl(null);
  const currentBrowseHref = buildCategoryUrl(selectedParent?.id ?? null);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Categories</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                {selectedParent ? `Browsing ${selectedParent.name}` : "Category structure"}
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
                Browse parent categories, drill into nested branches, and manage existing records without mixing creation or editing into the listing flow.
              </p>
            </div>
            <HeaderAssetSearch className="w-full xl:w-auto xl:flex-none" compact />
          </div>
        </PageHero>

        <section className="space-y-6">
          <PanelCard>
            <AdminSectionHeader
              actions={
                <>
                  {selectedParent ? (
                    <>
                      <Link href={buildAssetsUrl({ categoryId: selectedParent.id })}>
                        <Button type="button" variant="secondary">
                          View assets
                        </Button>
                      </Link>
                      <Link href={backHref}>
                        <Button type="button" variant="ghost">
                          Back to parents
                        </Button>
                      </Link>
                    </>
                  ) : null}
                  {permissionContext.capabilities.editCategories ? (
                    <Link href={buildNewCategoryUrl(selectedParent?.id ?? null)}>
                      <Button type="button">New category</Button>
                    </Link>
                  ) : null}
                </>
              }
              summary={summary}
              title={heading}
            />

            <div className="mt-5">
              {categoriesToRender.length === 0 ? (
                <AdminEmptyState className="border-slate-200 bg-slate-50 dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.16)]">
                  {selectedParent ? "Child categories will appear here." : "Parent category records will appear here."}
                </AdminEmptyState>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,1fr))] gap-4 2xl:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
                  {categoriesToRender.map((category) => {
                    const canDelete = category._count.children === 0 && category._count.assets === 0;
                    const browseHref = buildCategoryUrl(category.id);
                    const editHref = `/categories/${category.id}/edit?returnTo=${encodeURIComponent(currentBrowseHref)}`;
                    const viewAssetsHref = buildAssetsUrl({ categoryId: category.id });

                    return (
                      <article
                        key={category.id}
                        className="group relative flex min-h-[240px] cursor-pointer flex-col justify-between rounded-[28px] border border-slate-200/80 bg-white p-5 transition-colors duration-150 hover:border-slate-300 hover:shadow-panel dark:border-[#4b5255] dark:bg-[#2f3437]/80 dark:hover:border-slate-600"
                        style={buildColorCardStyle(category)}
                      >
                        <Link aria-label={`Open ${category.name}`} className="absolute inset-0 rounded-[28px]" href={browseHref} />
                        <div className="pointer-events-none relative z-10 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold leading-tight text-slate-950 dark:text-slate-100">{category.name}</h3>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{category.slug}</p>
                            </div>
                            {category.colorHex && category.colorMode ? (
                              <span
                                className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-[#2f3437]"
                                style={{ backgroundColor: category.colorHex }}
                              />
                            ) : null}
                          </div>

                          <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                            <p>
                              {category._count.children} child {category._count.children === 1 ? "category" : "categories"}
                            </p>
                            <p>
                              {category.branchAssetCount} asset{category.branchAssetCount === 1 ? "" : "s"} in branch
                            </p>
                          </div>
                        </div>

                        <div className="relative z-10 mt-6 flex flex-col gap-2.5">
                          <Link href={viewAssetsHref}>
                            <Button className={categoryCardActionClassName} type="button" variant="ghost">
                              View assets
                            </Button>
                          </Link>
                          {permissionContext.capabilities.editCategories ? (
                            <>
                              <Link href={editHref}>
                                <Button className={categoryCardActionClassName} type="button" variant="secondary">
                                  Edit
                                </Button>
                              </Link>
                              <form action={deleteCategoryAction}>
                                <input name="categoryId" type="hidden" value={category.id} />
                                <input name="parentId" type="hidden" value={selectedParent?.id ?? ""} />
                                <Button
                                  className={
                                    canDelete
                                      ? categoryCardDangerActionClassName
                                      : categoryCardStatusClassName
                                  }
                                  disabled={!canDelete}
                                  type="submit"
                                  variant="secondary"
                                >
                                  {canDelete ? "Delete" : "In use"}
                                </Button>
                              </form>
                            </>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </PanelCard>
        </section>
      </div>
    </AppShell>
  );
}
