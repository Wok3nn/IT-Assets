import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { CategoryEditCard } from "@/modules/categories/components/category-edit-card";
import { getCategoryById, updateCategorySettings } from "@/modules/categories/category.service";
import { listEnabledLabelTemplates } from "@/modules/labels/label-template.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type EditCategoryPageProps = {
  params: Promise<{
    categoryId: string;
  }>;
  searchParams?: Promise<{
    returnTo?: string;
  }>;
};

function buildCategoryReturnUrl(parentId: string | null) {
  if (!parentId) {
    return "/categories";
  }

  return `/categories?parentId=${parentId}`;
}

function normalizeCategoryReturnTo(value: string | null | undefined, parentId: string | null) {
  const trimmed = value?.trim();

  if (trimmed && trimmed.startsWith("/categories")) {
    return trimmed;
  }

  return buildCategoryReturnUrl(parentId);
}

async function updateCategorySettingsAction(formData: FormData) {
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
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();
  const colorModeValue = String(formData.get("colorMode") ?? "none").trim();
  const colorMode = colorModeValue === "border" || colorModeValue === "fill" ? colorModeValue : "none";
  const defaultLabelTemplateId = String(formData.get("defaultLabelTemplateId") ?? "").trim();

  if (!categoryId || name.length < 2) {
    return;
  }

  const category = await getCategoryById(categoryId);

  if (!category) {
    redirect("/categories");
  }

  await updateCategorySettings({
    categoryId,
    name,
    colorHex,
    colorMode,
    defaultLabelTemplateId: defaultLabelTemplateId || null,
  });

  revalidatePath("/categories");
  redirect(normalizeCategoryReturnTo(returnTo, category.parent?.id ?? null));
}

export default async function EditCategoryPage({ params, searchParams }: EditCategoryPageProps) {
  const [{ categoryId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

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

  if (!permissionContext.capabilities.editCategories) {
    notFound();
  }

  const [category, labelTemplates] = await Promise.all([
    getCategoryById(categoryId),
    listEnabledLabelTemplates(),
  ]);

  if (!category) {
    notFound();
  }

  const returnTo = normalizeCategoryReturnTo(resolvedSearchParams?.returnTo, category.parent?.id ?? null);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Categories</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                Edit {category.name}
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
                Adjust this category on its own screen, then return to the same branch without reopening an inline panel.
              </p>
            </div>
            <Link href={returnTo}>
              <Button type="button" variant="ghost">
                Back to categories
              </Button>
            </Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <CategoryEditCard
            action={updateCategorySettingsAction}
            cancelHref={returnTo}
            categoryId={category.id}
            defaultColorHex={category.colorHex}
            defaultColorMode={category.colorMode}
            defaultLabelTemplateId={category.defaultLabelTemplateId}
            defaultName={category.name}
            labelTemplateOptions={labelTemplates.map((template) => ({ id: template.id, name: template.name }))}
            returnTo={returnTo}
          />
        </div>
      </div>
    </AppShell>
  );
}
