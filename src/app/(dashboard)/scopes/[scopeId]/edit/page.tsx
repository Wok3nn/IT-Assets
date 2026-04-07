import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { ScopeEditCard } from "@/modules/scopes/components/scope-edit-card";
import { getScopeById, updateScope } from "@/modules/scopes/scope.service";
import { readSetupState } from "@/services/setup-state";

type EditScopePageProps = {
  params: Promise<{
    scopeId: string;
  }>;
  searchParams?: Promise<{
    returnTo?: string;
  }>;
};

const DEFAULT_SCOPES_RETURN_TO = "/scopes";

function normalizeScopesReturnTo(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (trimmed && trimmed.startsWith("/scopes")) {
    return trimmed;
  }

  return DEFAULT_SCOPES_RETURN_TO;
}

async function updateScopeAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const scopeId = String(formData.get("scopeId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();
  const colorModeValue = String(formData.get("colorMode") ?? "none").trim();
  const colorMode = colorModeValue === "border" || colorModeValue === "fill" ? colorModeValue : "none";

  if (!scopeId) {
    return;
  }

  const scope = await getScopeById(scopeId);

  if (!scope) {
    redirect(DEFAULT_SCOPES_RETURN_TO);
  }

  if (scope.isSystem) {
    redirect(normalizeScopesReturnTo(returnTo));
  }

  if (name.length < 2) {
    return;
  }

  await updateScope({
    scopeId,
    name,
    description,
    colorHex,
    colorMode,
  });

  revalidatePath("/scopes");
  redirect(normalizeScopesReturnTo(returnTo));
}

export default async function EditScopePage({ params, searchParams }: EditScopePageProps) {
  const [{ scopeId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const [setupState, currentUser, scope] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getScopeById(scopeId),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!scope) {
    redirect(DEFAULT_SCOPES_RETURN_TO);
  }

  const returnTo = normalizeScopesReturnTo(resolvedSearchParams?.returnTo);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Departments</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                Edit {scope.name}
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
                Update this department on its own screen, then return to the listing without reopening an inline panel.
              </p>
            </div>
            <Link href={returnTo}>
              <Button type="button" variant="ghost">
                Back to departments
              </Button>
            </Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <ScopeEditCard
            action={updateScopeAction}
            cancelHref={returnTo}
            defaultColorHex={scope.colorHex}
            defaultColorMode={scope.colorMode}
            defaultDescription={scope.description}
            defaultName={scope.name}
            isSystem={scope.isSystem}
            returnTo={returnTo}
            scopeId={scope.id}
          />
        </div>
      </div>
    </AppShell>
  );
}
