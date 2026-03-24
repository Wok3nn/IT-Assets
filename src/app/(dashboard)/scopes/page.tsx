import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminTextField, AdminTextareaField } from "@/components/admin/admin-fields";
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
import { createScope, deleteScope, getScopeById, listScopes, updateScope } from "@/modules/scopes/scope.service";
import { readSetupState } from "@/services/setup-state";

type ScopesPageProps = {
  searchParams?: Promise<{
    editId?: string;
    showDescription?: string;
    showSubtitle?: string;
  }>;
};

function buildGroupsUrl(options?: {
  editId?: string | null;
  showDescription?: boolean;
  showSubtitle?: boolean;
}) {
  const params = new URLSearchParams();

  if (options?.editId) {
    params.set("editId", options.editId);
  }

  if (options?.showDescription === false) {
    params.set("showDescription", "false");
  }

  if (options?.showSubtitle === false) {
    params.set("showSubtitle", "false");
  }

  const query = params.toString();
  return query ? `/scopes?${query}` : "/scopes";
}

async function createGroupAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
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
}

async function updateGroupAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const scopeId = String(formData.get("scopeId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();
  const colorModeValue = String(formData.get("colorMode") ?? "none").trim();
  const colorMode = colorModeValue === "border" || colorModeValue === "fill" ? colorModeValue : "none";
  const showDescription = String(formData.get("showDescription") ?? "true") !== "false";
  const showSubtitle = String(formData.get("showSubtitle") ?? "true") !== "false";

  if (!scopeId || name.length < 2) {
    return;
  }

  await updateScope({ scopeId, name, description, colorHex, colorMode });
  revalidatePath("/scopes");
  redirect(buildGroupsUrl({ showDescription, showSubtitle }));
}

async function deleteGroupAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const scopeId = String(formData.get("scopeId") ?? "").trim();

  if (!scopeId) {
    return;
  }

  await deleteScope(scopeId);
  revalidatePath("/scopes");
}

export default async function ScopesPage({ searchParams }: ScopesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const editGroupId = resolvedSearchParams?.editId?.trim() || null;
  const showDescription = resolvedSearchParams?.showDescription !== "false";
  const showSubtitle = resolvedSearchParams?.showSubtitle !== "false";

  const [setupState, currentUser, groups, editGroup] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    listScopes(),
    editGroupId ? getScopeById(editGroupId) : Promise.resolve(null),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (editGroupId && !editGroup) {
    redirect(buildGroupsUrl({ showDescription, showSubtitle }));
  }

  const summary =
    groups.length === 0
      ? "No groups exist yet. Add the first one to control who can see tagged assets."
      : `${groups.length} group${groups.length === 1 ? "" : "s"} available for users and assets.`;

  const toggleDescriptionHref = buildGroupsUrl({
    editId: editGroupId,
    showDescription: !showDescription,
    showSubtitle,
  });

  const toggleSubtitleHref = buildGroupsUrl({
    editId: editGroupId,
    showDescription,
    showSubtitle: !showSubtitle,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Departments</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Asset permissions</h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Assign users to groups. Assets tagged to a group stay visible to the right people.
          </p>
        </PageHero>

        <AdminPageColumns>
          <div className="space-y-6">
            <PanelCard>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">New group</h2>
              <form action={createGroupAction} className="mt-5 space-y-4">
                <FieldLabel>
                  <FieldLabelText>Name</FieldLabelText>
                  <AdminTextField maxLength={80} minLength={2} name="name" placeholder="IT" required type="text" />
                </FieldLabel>

                <FieldLabel>
                  <FieldLabelText>Description</FieldLabelText>
                  <AdminTextareaField
                    maxLength={240}
                    name="description"
                    placeholder="Assets for the internal IT team."
                    rows={4}
                  />
                </FieldLabel>

                <ColorStyleFields defaultColorMode="border" defaultColorHex="#2563EB" helperText="Border or soft fill." />

                <Button className="w-full" type="submit">
                  Create group
                </Button>
              </form>
            </PanelCard>

            {editGroup ? (
              <PanelCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Edit group</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{editGroup.name}</p>
                  </div>
                  <Link href={buildGroupsUrl({ showDescription, showSubtitle })}>
                    <Button type="button" variant="ghost">
                      Close
                    </Button>
                  </Link>
                </div>

                <form action={updateGroupAction} className="mt-5 space-y-4">
                  <input name="scopeId" type="hidden" value={editGroup.id} />
                  <input name="showDescription" type="hidden" value={showDescription ? "true" : "false"} />
                  <input name="showSubtitle" type="hidden" value={showSubtitle ? "true" : "false"} />

                  <FieldLabel>
                    <FieldLabelText>Name</FieldLabelText>
                    <AdminTextField
                      defaultValue={editGroup.name}
                      disabled={editGroup.isSystem}
                      maxLength={80}
                      minLength={2}
                      name="name"
                      required
                      type="text"
                    />
                  </FieldLabel>

                  <FieldLabel>
                    <FieldLabelText>Description</FieldLabelText>
                    <AdminTextareaField
                      defaultValue={editGroup.description ?? ""}
                      disabled={editGroup.isSystem}
                      maxLength={240}
                      name="description"
                      rows={4}
                    />
                  </FieldLabel>

                  <ColorStyleFields
                    defaultColorHex={editGroup.colorHex}
                    defaultColorMode={editGroup.colorMode ?? "none"}
                    disabled={editGroup.isSystem}
                    helperText="Update the visual cue for this group."
                    title="Color"
                  />

                  {editGroup.isSystem ? (
                    <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-500/10 dark:text-emerald-300">
                      System groups are visible here but locked from editing.
                    </p>
                  ) : null}

                  <Button className="w-full" disabled={editGroup.isSystem} type="submit">
                    Save group
                  </Button>
                </form>
              </PanelCard>
            ) : null}
          </div>

          <PanelCard>
            <AdminSectionHeader
              actions={
                <>
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
              title="Groups"
            />

            <div className="mt-5">
              {groups.length === 0 ? (
                <AdminEmptyState>Group records will appear here once they are created.</AdminEmptyState>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 2xl:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
                  {groups.map((group) => {
                    const canDelete = !group.isSystem && group._count.userScopes === 0 && group._count.assetScopes === 0;
                    const editHref = buildGroupsUrl({ editId: group.id, showDescription, showSubtitle });

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
                              {showSubtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{group.slug}</p> : null}
                            </div>
                            {group.colorHex && group.colorMode ? (
                              <span
                                className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-950"
                                style={{ backgroundColor: group.colorHex }}
                              />
                            ) : null}
                          </div>

                          {showDescription ? (
                            <p className="min-h-[72px] text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {group.description || "No description yet. Add context so assignments stay predictable."}
                            </p>
                          ) : null}

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
