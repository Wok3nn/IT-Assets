import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { ScopeCreateCard } from "@/modules/scopes/components/scope-create-card";
import { createScope } from "@/modules/scopes/scope.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

const SCOPES_DIRECTORY_HREF = "/scopes";

async function createGroupAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserPermissionContext();

  if (!permissionContext.capabilities.editDepartments) {
    redirect(SCOPES_DIRECTORY_HREF);
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();
  const colorModeValue = String(formData.get("colorMode") ?? "none").trim();
  const colorMode = colorModeValue === "border" || colorModeValue === "fill" ? colorModeValue : "none";

  if (name.length < 2) {
    return;
  }

  await createScope({ name, description, colorHex, colorMode });
  revalidatePath("/scopes");
  redirect(SCOPES_DIRECTORY_HREF);
}

export default async function NewScopePage() {
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

  if (!permissionContext.capabilities.editDepartments) {
    notFound();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Departments</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">New department</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Create a department in its own dedicated flow so browsing and managing existing visibility groups stays focused and easier to scan.</p>
            </div>
            <Link href={SCOPES_DIRECTORY_HREF}><Button type="button" variant="ghost">Back to departments</Button></Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <ScopeCreateCard action={createGroupAction} cancelHref={SCOPES_DIRECTORY_HREF} />
        </div>
      </div>
    </AppShell>
  );
}
