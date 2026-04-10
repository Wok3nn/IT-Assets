import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
import { deleteScope, listScopes } from "@/modules/scopes/scope.service";
import { readSetupState } from "@/services/setup-state";

type ScopesPageProps = {
  searchParams?: Promise<Record<string, never>>;
};

const GROUPS_HREF = "/scopes";
const NEW_SCOPE_HREF = "/scopes/new";

async function deleteGroupAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserPermissionContext();

  if (!permissionContext.capabilities.editDepartments) {
    redirect("/scopes");
  }

  const scopeId = String(formData.get("scopeId") ?? "").trim();

  if (!scopeId) {
    return;
  }

  await deleteScope(scopeId);
  revalidatePath("/scopes");
}

export default async function ScopesPage({ searchParams }: ScopesPageProps) {
  if (searchParams) {
    await searchParams;
  }

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

  if (!permissionContext.capabilities.viewDepartments) {
    redirect("/dashboard");
  }

  const groups = await listScopes();

  const summary =
    groups.length === 0
      ? "No groups exist yet. Add the first one to control who can see tagged assets."
      : `${groups.length} group${groups.length === 1 ? "" : "s"} available for users and assets.`;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Departments</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Asset permissions</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
                Browse department records and manage existing visibility groups without mixing creation or editing into the listing flow.
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
                  {permissionContext.capabilities.editDepartments ? (
                    <Link href={NEW_SCOPE_HREF}>
                      <Button type="button">New department</Button>
                    </Link>
                  ) : null}
                </>
              }
              summary={summary}
              title="Groups"
            />

            <div className="mt-5">
              {groups.length === 0 ? (
                <AdminEmptyState>Group records will appear here once they are created.</AdminEmptyState>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 2xl:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
                  {groups.map((group) => {
                    const canDelete = !group.isSystem && group._count.userScopes === 0 && group._count.assetScopes === 0;
                    const editHref = `/scopes/${group.id}/edit?returnTo=${encodeURIComponent(GROUPS_HREF)}`;

                    return (
                      <article
                        key={group.id}
                        className="relative flex min-h-[240px] cursor-pointer flex-col justify-between rounded-[28px] border border-[#ece7df] bg-white/96 p-5 transition hover:border-[#f0c48d] hover:shadow-panel dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_16px_30px_rgba(0,0,0,0.18)] dark:hover:border-[#f0a853]"
                        style={buildColorCardStyle(group)}
                      >
                        <Link aria-label={`Edit ${group.name}`} className="absolute inset-0 rounded-[28px]" href={editHref} />
                        <div className="pointer-events-none relative z-10 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold leading-tight text-slate-950 dark:text-slate-100">{group.name}</h3>
                                {group.isSystem ? (
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                    System
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{group.slug}</p>
                            </div>
                            {group.colorHex && group.colorMode ? (
                              <span
                                className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-950"
                                style={{ backgroundColor: group.colorHex }}
                              />
                            ) : null}
                          </div>

                          <p className="min-h-[72px] text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {group.description || "No description yet. Add context so assignments stay predictable."}
                          </p>

                          <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                            <p>
                              {group._count.userScopes} mapped {group._count.userScopes === 1 ? "user" : "users"}
                            </p>
                            <p>
                              {group._count.assetScopes} linked {group._count.assetScopes === 1 ? "asset" : "assets"}
                            </p>
                          </div>
                        </div>

                        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3">
                          {permissionContext.capabilities.editDepartments ? (
                            <>
                              <Link href={editHref}>
                                <Button className="w-full" type="button" variant="secondary">
                                  Edit
                                </Button>
                              </Link>
                              <form action={deleteGroupAction}>
                                <input name="scopeId" type="hidden" value={group.id} />
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
                                  {group.isSystem ? "System" : canDelete ? "Delete" : "In use"}
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
