import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { CategoryCreateCard } from "@/modules/categories/components/category-create-card";
import { createCategory, getCategoryById, listAllCategories } from "@/modules/categories/category.service";
import { listEnabledLabelTemplates } from "@/modules/labels/label-template.service";
import { readSetupState } from "@/services/setup-state";

type NewCategoryPageProps = {
  searchParams?: Promise<{
    parentId?: string;
  }>;
};

function buildCategoryUrl(parentId: string | null) {
  if (!parentId) {
    return "/categories";
  }

  return `/categories?parentId=${parentId}`;
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
  const defaultLabelTemplateId = String(formData.get("defaultLabelTemplateId") ?? "").trim();

  if (name.length < 2) {
    return;
  }

  await createCategory({
    name,
    parentId: parentIdValue || null,
    colorHex,
    colorMode,
    defaultLabelTemplateId: defaultLabelTemplateId || null,
  });

  revalidatePath("/categories");
  redirect(buildCategoryUrl(parentIdValue || null));
}

export default async function NewCategoryPage({ searchParams }: NewCategoryPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const defaultParentId = resolvedSearchParams?.parentId?.trim() || null;

  const [setupState, currentUser, categories, defaultParent, labelTemplates] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    listAllCategories(),
    defaultParentId ? getCategoryById(defaultParentId) : Promise.resolve(null),
    listEnabledLabelTemplates(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (defaultParentId && !defaultParent) {
    redirect("/categories/new");
  }

  const cancelHref = buildCategoryUrl(defaultParentId);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Categories</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">New category</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Create a top-level category or attach a child category to an existing branch without leaving the main Categories list cluttered with inline setup forms.</p>
            </div>
            <Link href={cancelHref}><Button type="button" variant="ghost">Back to categories</Button></Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <CategoryCreateCard
            action={createCategoryAction}
            cancelHref={cancelHref}
            defaultParentId={defaultParentId ?? ""}
            labelTemplateOptions={labelTemplates.map((template) => ({ id: template.id, name: template.name }))}
            parentOptions={categories}
          />
        </div>
      </div>
    </AppShell>
  );
}
