import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { RoleCardsGrid } from "@/modules/users/components/role-cards-grid";
import { UsersDirectoryList } from "@/modules/users/components/users-directory-list";
import { UsersFilterBar } from "@/modules/users/components/users-filter-bar";
import { UsersHeader } from "@/modules/users/components/users-header";
import {
  buildRoleFilteredUsersUrl,
  buildUserEditHref,
  buildUsersUrl,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  parseLoginFilter,
  parsePage,
  parsePageSize,
  parseSort,
  parseStatus,
  parseViewMode,
  type LoginFilter,
  type SortOption,
  type UserStatusFilter,
  USERS_DIRECTORY_HREF,
  USERS_NEW_HREF,
} from "@/modules/users/users-routing";
import {
  deleteUser,
  listAssignableRoles,
  listAssignableScopes,
  listUsers,
} from "@/modules/users/user.service";
import { readSetupState } from "@/services/setup-state";

type UsersPageProps = {
  searchParams?: Promise<{
    view?: string;
    roleKey?: string;
    editId?: string;
    q?: string;
    filterRoleKey?: string;
    scopeId?: string;
    status?: string;
    login?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function filterUsers(
  users: Awaited<ReturnType<typeof listUsers>>,
  options: { q: string; roleKey?: string | null; scopeId?: string | null; status: UserStatusFilter; login: LoginFilter },
) {
  const q = options.q.trim().toLowerCase();

  return users.filter((user) => {
    if (q && !user.name.toLowerCase().includes(q) && !user.email.toLowerCase().includes(q)) return false;
    if (options.roleKey && !user.userRoles.some(({ role }) => role.key === options.roleKey)) return false;
    if (options.scopeId && !user.userScopes.some(({ scope }) => scope.id === options.scopeId)) return false;
    if (options.status === "active" && !user.isActive) return false;
    if (options.status === "inactive" && user.isActive) return false;
    if (options.login === "enabled" && !user.canLogin) return false;
    if (options.login === "disabled" && user.canLogin) return false;
    return true;
  });
}

function sortUsers(users: Awaited<ReturnType<typeof listUsers>>, sort: SortOption) {
  const next = [...users];

  next.sort((left, right) => {
    if (sort === "name-desc") return right.name.localeCompare(left.name);
    if (sort === "email-asc") return left.email.localeCompare(right.email);

    if (sort === "last-login") {
      const leftTime = left.lastLoginAt ? left.lastLoginAt.getTime() : 0;
      const rightTime = right.lastLoginAt ? right.lastLoginAt.getTime() : 0;
      return rightTime - leftTime || left.name.localeCompare(right.name);
    }

    return left.name.localeCompare(right.name);
  });

  return next;
}

async function deleteUserAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }
  const permissionContext = await getCurrentUserPermissionContext();

  if (!permissionContext.capabilities.editUsers) {
    redirect("/users?view=users");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const view = parseViewMode(String(formData.get("view") ?? "roles"));
  const selectedRoleKey = String(formData.get("selectedRoleKey") ?? "").trim();
  const searchQuery = String(formData.get("q") ?? "").trim();
  const filterRoleKey = String(formData.get("filterRoleKey") ?? "").trim();
  const scopeId = String(formData.get("scopeId") ?? "").trim();
  const status = parseStatus(String(formData.get("status") ?? "all"));
  const login = parseLoginFilter(String(formData.get("login") ?? "all"));
  const sort = parseSort(String(formData.get("sort") ?? "name-asc"));
  const page = parsePage(String(formData.get("page") ?? "1"));
  const pageSize = parsePageSize(String(formData.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)));

  if (!userId) {
    return;
  }

  await deleteUser(userId, currentUser.id);
  revalidatePath("/users");
  redirect(
    buildUsersUrl({
      view,
      roleKey: view === "roles" ? selectedRoleKey || null : null,
      q: searchQuery || null,
      filterRoleKey: view === "users" ? filterRoleKey || null : null,
      scopeId: view === "users" ? scopeId || null : null,
      status: view === "users" ? status : null,
      login: view === "users" ? login : null,
      sort: view === "users" ? sort : null,
      page: view === "users" ? page : null,
      pageSize: view === "users" ? pageSize : null,
    }),
  );
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const legacyRoleKey = resolvedSearchParams?.roleKey?.trim() || null;
  const legacyEditUserId = resolvedSearchParams?.editId?.trim() || null;
  const view = parseViewMode(resolvedSearchParams?.view);
  const searchQuery = resolvedSearchParams?.q?.trim() || "";
  const filterRoleKey = resolvedSearchParams?.filterRoleKey?.trim() || null;
  const scopeId = resolvedSearchParams?.scopeId?.trim() || null;
  const status = parseStatus(resolvedSearchParams?.status);
  const login = parseLoginFilter(resolvedSearchParams?.login);
  const sort = parseSort(resolvedSearchParams?.sort);
  const requestedPage = parsePage(resolvedSearchParams?.page);
  const pageSize = parsePageSize(resolvedSearchParams?.pageSize);

  if (legacyRoleKey) {
    redirect(buildRoleFilteredUsersUrl(legacyRoleKey, { q: searchQuery || null, pageSize }));
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

  if (!permissionContext.capabilities.viewUsers) {
    redirect("/dashboard");
  }

  const [users, roles, scopes] = await Promise.all([
    listUsers(),
    listAssignableRoles(),
    listAssignableScopes(),
  ]);

  const selectedFilterRole = filterRoleKey ? roles.find((role) => role.key === filterRoleKey) ?? null : null;
  const selectedScope = scopeId ? scopes.find((scope) => scope.id === scopeId) ?? null : null;

  if (view === "users" && filterRoleKey && !selectedFilterRole) {
    redirect(buildUsersUrl({ view: "users", q: searchQuery || null, scopeId, status, login, sort, pageSize }));
  }

  if (view === "users" && scopeId && !selectedScope) {
    redirect(buildUsersUrl({ view: "users", q: searchQuery || null, filterRoleKey, status, login, sort, pageSize }));
  }

  const filteredUsers = sortUsers(
    filterUsers(users, {
      q: searchQuery,
      roleKey: view === "users" ? filterRoleKey : null,
      scopeId: view === "users" ? scopeId : null,
      status,
      login,
    }),
    sort,
  );
  const totalUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStartIndex = totalUsers === 0 ? 0 : (currentPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(pageStartIndex, pageStartIndex + pageSize);
  const pageStart = totalUsers === 0 ? 0 : pageStartIndex + 1;
  const pageEnd = totalUsers === 0 ? 0 : Math.min(pageStartIndex + pageSize, totalUsers);

  if (view === "users" && requestedPage !== currentPage) {
    redirect(buildUsersUrl({ view: "users", q: searchQuery || null, filterRoleKey, scopeId, status, login, sort, page: currentPage, pageSize }));
  }

  const usersViewHref = buildUsersUrl({
    view: "users",
    q: searchQuery || null,
    filterRoleKey,
    scopeId,
    status,
    login,
    sort,
    page: currentPage,
    pageSize,
  });

  if (legacyEditUserId) {
    redirect(buildUserEditHref(legacyEditUserId, usersViewHref));
  }

  const roleCards = roles.map((role) => {
    const roleUsers = users.filter((user) => user.userRoles.some(({ role: userRole }) => userRole.key === role.key));

    return {
      ...role,
      totalUsers: roleUsers.length,
      activeUsers: roleUsers.filter((user) => user.isActive).length,
      loginEnabledUsers: roleUsers.filter((user) => user.canLogin).length,
    };
  });

  const summary =
    view === "roles"
      ? `${roleCards.length} role${roleCards.length === 1 ? "" : "s"} available. Open a card to browse members in the standard user directory.`
      : totalUsers === 0
        ? selectedFilterRole
          ? `No users matched the current filters for ${selectedFilterRole.name}.`
          : "No users matched the current filters."
        : selectedFilterRole
          ? `Showing ${pageStart}-${pageEnd} of ${totalUsers} users in ${selectedFilterRole.name}.`
          : `Showing ${pageStart}-${pageEnd} of ${totalUsers} users.`;

  const rolesViewHref = buildUsersUrl({ view: "roles" });

  return (
    <AppShell>
      <div className="space-y-6">
        <UsersHeader rolesViewHref={rolesViewHref} selectedRoleName={null} usersViewHref={usersViewHref} view={view} />

        <section className="space-y-6">
          <PanelCard>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
                  {view === "users" ? selectedFilterRole ? `${selectedFilterRole.name} users` : "All users" : "Roles"}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{summary}</p>
              </div>
              {view === "users" ? (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedFilterRole ? (
                    <Link href={rolesViewHref}>
                      <Button type="button" variant="ghost">Back to roles</Button>
                    </Link>
                  ) : null}
                  {permissionContext.capabilities.editUsers ? (
                    <Link href={USERS_NEW_HREF}>
                      <Button type="button">New user</Button>
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-5">
              {view === "roles" ? (
                <RoleCardsGrid buildMemberHref={(roleKey) => buildRoleFilteredUsersUrl(roleKey)} roleCards={roleCards} />
              ) : (
                <div className="space-y-4">
                  <UsersFilterBar
                    filterRoleKey={filterRoleKey}
                    login={login}
                    pageSize={pageSize}
                    resetHref={USERS_DIRECTORY_HREF}
                    roles={roles}
                    scopeId={scopeId}
                    scopes={scopes}
                    searchQuery={searchQuery}
                    sort={sort}
                    status={status}
                  />
                  <UsersDirectoryList
                    buildEditHref={(userId) => buildUserEditHref(userId, usersViewHref)}
                    currentPage={currentPage}
                    currentUserId={currentUser.id}
                    nextPageHref={currentPage < totalPages ? buildUsersUrl({ view: "users", q: searchQuery || null, filterRoleKey, scopeId, status, login, sort, page: currentPage + 1, pageSize }) : null}
                    pageEnd={pageEnd}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS.map((option) => ({
                      href: buildUsersUrl({ view: "users", q: searchQuery || null, filterRoleKey, scopeId, status, login, sort, page: 1, pageSize: option }),
                      isActive: option === pageSize,
                      value: option,
                    }))}
                    previousPageHref={currentPage > 1 ? buildUsersUrl({ view: "users", q: searchQuery || null, filterRoleKey, scopeId, status, login, sort, page: currentPage - 1, pageSize }) : null}
                    renderDeleteForm={(userId, canDelete) => (
                      permissionContext.capabilities.editUsers ? (
                        <form action={deleteUserAction}>
                          <input name="userId" type="hidden" value={userId} />
                          <input name="view" type="hidden" value="users" />
                          <input name="q" type="hidden" value={searchQuery} />
                          <input name="filterRoleKey" type="hidden" value={filterRoleKey ?? ""} />
                          <input name="scopeId" type="hidden" value={scopeId ?? ""} />
                          <input name="status" type="hidden" value={status} />
                          <input name="login" type="hidden" value={login} />
                          <input name="sort" type="hidden" value={sort} />
                          <input name="page" type="hidden" value={currentPage} />
                          <input name="pageSize" type="hidden" value={pageSize} />
                          <Button
                            className={
                              canDelete
                                ? "rounded-2xl px-3 py-1.5 text-xs hover:bg-red-600 hover:text-white hover:ring-red-600 dark:hover:bg-red-500"
                                : "rounded-2xl bg-emerald-100 px-3 py-1.5 text-xs text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-900/70 dark:hover:bg-emerald-500/25"
                            }
                            disabled={!canDelete}
                            type="submit"
                            variant="secondary"
                          >
                            {userId === currentUser.id ? "Current user" : canDelete ? "Delete" : "In use"}
                          </Button>
                        </form>
                      ) : null
                    )}
                    totalPages={totalPages}
                    totalUsers={totalUsers}
                    users={paginatedUsers}
                    canEditUsers={permissionContext.capabilities.editUsers}
                  />
                </div>
              )}
            </div>
          </PanelCard>
        </section>
      </div>
    </AppShell>
  );
}
