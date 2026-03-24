import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminTextField } from "@/components/admin/admin-fields";
import { AdminPageColumns } from "@/components/admin/admin-page-columns";
import { AdminSectionHeader } from "@/components/admin/admin-section-header";
import { buildColorCardStyle } from "@/components/admin/card-style";
import { ColorStyleFields } from "@/components/admin/color-style-fields";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listChildCategories,
  listTopLevelCategories,
  updateCategorySettings,
} from "@/modules/categories/category.service";
import { readSetupState } from "@/services/setup-state";

type CategoriesPageProps = {
  searchParams?: Promise<{
    parentId?: string;
    editId?: string;
    showDescription?: string;
    showSubtitle?: string;
  }>;
};

function buildCategoryUrl(parentId: string | null, editId?: string | null, showDescription = true, showSubtitle = true) {
  const params = new URLSearchParams();

  if (parentId) {
    params.set("parentId", parentId);
  }

  if (editId) {
    params.set("editId", editId);
  }

  if (!showDescription) {
    params.set("showDescription", "false");
  }

  if (!showSubtitle) {
    params.set("showSubtitle", "false");
  }

  const query = params.toString();
  return query ? `/categories?${query}` : "/categories";
}

async function createCategoryAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const parentIdValue = String(formData.get("parentId") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();
  const colorModeValue = String(formData.get("colorMode") ?? "none").trim();
  const colorMode = colorModeValue === "border" || colorModeValue === "fill" ? colorModeValue : "none";

  if (name.length < 2) {
    return;
  }

  await createCategory({
    name,
    parentId: parentIdValue || null,
    colorHex,
    colorMode,
  });

  revalidatePath("/categories");

  if (parentIdValue) {
    redirect(buildCategoryUrl(parentIdValue));
  }
}

async function updateCategorySettingsAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const parentIdValue = String(formData.get("parentId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();
  const colorModeValue = String(formData.get("colorMode") ?? "none").trim();
  const colorMode = colorModeValue === "border" || colorModeValue === "fill" ? colorModeValue : "none";
  const showDescription = String(formData.get("showDescription") ?? "true") !== "false";
  const showSubtitle = String(formData.get("showSubtitle") ?? "true") !== "false";

  if (!categoryId || name.length < 2) {
    return;
  }

  await updateCategorySettings({
    categoryId,
    name,
    colorHex,
    colorMode,
  });

  revalidatePath("/categories");
  redirect(buildCategoryUrl(parentIdValue || null, null, showDescription, showSubtitle));
}

async function deleteCategoryAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const parentIdValue = String(formData.get("parentId") ?? "").trim();
  const showDescription = String(formData.get("showDescription") ?? "true") !== "false";
  const showSubtitle = String(formData.get("showSubtitle") ?? "true") !== "false";

  if (!categoryId) {
    return;
  }

  await deleteCategory(categoryId);
  revalidatePath("/categories");

  if (parentIdValue) {
    redirect(buildCategoryUrl(parentIdValue, null, showDescription, showSubtitle));
  }
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedParentId = resolvedSearchParams?.parentId?.trim() || null;
  const editCategoryId = resolvedSearchParams?.editId?.trim() || null;
  const showDescription = resolvedSearchParams?.showDescription !== "false";
  const showSubtitle = resolvedSearchParams?.showSubtitle !== "false";

  const [setupState, currentUser, topLevelCategories, selectedParent, editCategory] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    listTopLevelCategories(),
    selectedParentId ? getCategoryById(selectedParentId) : Promise.resolve(null),
    editCategoryId ? getCategoryById(editCategoryId) : Promise.resolve(null),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

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
    ? buildCategoryUrl(selectedParent.parent.id, null, showDescription, showSubtitle)
    : buildCategoryUrl(null, null, showDescription, showSubtitle);
  const editMatchesView =
    editCategory &&
    ((selectedParent && editCategory.parentId === selectedParent.id) || (!selectedParent && editCategory.parentId === null));
  const activeEditCategory = editMatchesView ? editCategory : null;
  const toggleSubtitleHref = buildCategoryUrl(selectedParent?.id ?? null, editCategoryId, showDescription, !showSubtitle);
  const toggleDescriptionHref = buildCategoryUrl(selectedParent?.id ?? null, editCategoryId, !showDescription, showSubtitle);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Categories</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            {selectedParent ? `Browsing ${selectedParent.name}` : "Category structure"}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            {selectedParent
              ? "This view focuses on one parent at a time so child categories stay readable and easier to manage."
              : "Create high-level parent categories first, then open a category tile to manage the children inside it."}
          </p>
        </PageHero>

        <AdminPageColumns>
          <div className="space-y-6">
            <PanelCard>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
                {selectedParent ? `New child for ${selectedParent.name}` : "New parent category"}
              </h2>
              <form action={createCategoryAction} className="mt-5 space-y-4">
                <input name="parentId" type="hidden" value={selectedParent?.id ?? ""} />

                <FieldLabel>
                  <FieldLabelText>Name</FieldLabelText>
                  <AdminTextField
                    maxLength={80}
                    minLength={2}
                    name="name"
                    placeholder={selectedParent ? "Ultrabooks" : "Laptops"}
                    required
                    type="text"
                  />
                </FieldLabel>

                <ColorStyleFields defaultColorMode="border" defaultColorHex="#2563EB" helperText="Border or soft fill." />

                <Button className="w-full" type="submit">
                  {selectedParent ? "Create child category" : "Create parent category"}
                </Button>
              </form>
            </PanelCard>

            {activeEditCategory ? (
              <PanelCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Edit settings</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{activeEditCategory.name}</p>
                  </div>
                  <Link href={buildCategoryUrl(selectedParent?.id ?? null, null, showDescription, showSubtitle)}>
                    <Button type="button" variant="ghost">Close</Button>
                  </Link>
                </div>

                <form action={updateCategorySettingsAction} className="mt-5 space-y-4">
                  <input name="categoryId" type="hidden" value={activeEditCategory.id} />
                  <input name="parentId" type="hidden" value={selectedParent?.id ?? ""} />
                  <input name="showDescription" type="hidden" value={showDescription ? "true" : "false"} />
                  <input name="showSubtitle" type="hidden" value={showSubtitle ? "true" : "false"} />

                  <FieldLabel>
                    <FieldLabelText>Name</FieldLabelText>
                    <AdminTextField
                      defaultValue={activeEditCategory.name}
                      maxLength={80}
                      minLength={2}
                      name="name"
                      required
                      type="text"
                    />
                  </FieldLabel>

                  <ColorStyleFields
                    defaultColorHex={activeEditCategory.colorHex}
                    defaultColorMode={activeEditCategory.colorMode ?? "none"}
                    helperText="Update the visual cue for this category."
                    title="Color"
                  />

                  <Button className="w-full" type="submit">Save settings</Button>
                </form>
              </PanelCard>
            ) : null}
          </div>

          <PanelCard>
            <AdminSectionHeader
              actions={
                <>
                  {selectedParent ? (
                    <Link href={backHref}>
                      <Button type="button" variant="ghost">
                        Back to parents
                      </Button>
                    </Link>
                  ) : null}
                  <Link href={toggleSubtitleHref}>
                    <Button type="button" variant={showSubtitle ? "secondary" : "ghost"}>
                      {showSubtitle ? "Hide subtitle" : "Show subtitle"}
                    </Button>
                  </Link>
                  <Link href={toggleDescriptionHref}>
                    <Button type="button" variant={showDescription ? "secondary" : "ghost"}>
                      {showDescription ? "Hide description" : "Show description"}
                    </Button>
                  </Link>
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
                    const browseHref = buildCategoryUrl(category.id, null, showDescription, showSubtitle);
                    const editHref = buildCategoryUrl(selectedParent?.id ?? null, category.id, showDescription, showSubtitle);

                    return (
                      <article
                        key={category.id}
                        className="relative flex min-h-[240px] cursor-pointer flex-col justify-between rounded-[28px] border border-slate-200/80 bg-white p-5 transition hover:border-slate-300 hover:shadow-panel dark:border-[#4b5255] dark:bg-[#2f3437]/80 dark:hover:border-slate-600"
                        style={buildColorCardStyle(category)}
                      >
                        <Link aria-label={`Open ${category.name}`} className="absolute inset-0 rounded-[28px]" href={browseHref} />
                        <div className="pointer-events-none relative z-10 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold leading-tight text-slate-950 dark:text-slate-100">{category.name}</h3>
                              {showSubtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{category.slug}</p> : null}
                            </div>
                            {category.colorHex && category.colorMode ? (
                              <span
                                className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-[#2f3437]"
                                style={{ backgroundColor: category.colorHex }}
                              />
                            ) : null}
                          </div>

                          {showDescription ? (
                            <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                              <p>
                                {category._count.children} child {category._count.children === 1 ? "category" : "categories"}
                              </p>
                              <p>
                                {category._count.assets} assigned {category._count.assets === 1 ? "asset" : "assets"}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3">
                          <Link href={editHref}>
                            <Button className="w-full" type="button" variant="secondary">
                              Edit
                            </Button>
                          </Link>
                          <form action={deleteCategoryAction}>
                            <input name="categoryId" type="hidden" value={category.id} />
                            <input name="parentId" type="hidden" value={selectedParent?.id ?? ""} />
                            <input name="showDescription" type="hidden" value={showDescription ? "true" : "false"} />
                            <input name="showSubtitle" type="hidden" value={showSubtitle ? "true" : "false"} />
                            <Button
                              className={
                                canDelete
                                  ? "w-full rounded-2xl hover:bg-red-600 hover:text-white hover:ring-red-600 dark:hover:bg-red-500"
                                  : "w-full rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-900/70 dark:hover:bg-emerald-500/25"
                              }
                              disabled={!canDelete}
                              type="submit"
                              variant="secondary"
                            >
                              {canDelete ? "Delete" : "In use"}
                            </Button>
                          </form>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </PanelCard>
        </AdminPageColumns>
      </div>
    </AppShell>
  );
}

