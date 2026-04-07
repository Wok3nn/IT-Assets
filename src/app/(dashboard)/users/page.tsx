import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { RoleCardsGrid } from "@/modules/users/components/role-cards-grid";
import { UserEditCard } from "@/modules/users/components/user-edit-card";
import { UsersDirectoryList } from "@/modules/users/components/users-directory-list";
import { UsersFilterBar } from "@/modules/users/components/users-filter-bar";
import { UsersHeader } from "@/modules/users/components/users-header";
import {
  deleteUser,
  getUserById,
  listAssignableRoles,
  listAssignableScopes,
  listUsers,
  updateUser,
} from "@/modules/users/user.service";
import { readSetupState } from "@/services/setup-state";

type ViewMode = "roles" | "users";
type UserStatusFilter = "all" | "active" | "inactive";
type LoginFilter = "all" | "enabled" | "disabled";
type SortOption = "name-asc" | "name-desc" | "email-asc" | "last-login";
type PageSizeOption = 25 | 50;

const DEFAULT_PAGE_SIZE: PageSizeOption = 25;
const PAGE_SIZE_OPTIONS: PageSizeOption[] = [25, 50];
const USERS_DIRECTORY_HREF = "/users?view=users";
const USERS_NEW_HREF = "/users/new";

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

function parseViewMode(value?: string): ViewMode {
  return value === "users" ? "users" : "roles";
}

function parseStatus(value?: string): UserStatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

function parseLoginFilter(value?: string): LoginFilter {
  return value === "enabled" || value === "disabled" ? value : "all";
}

function parseSort(value?: string): SortOption {
  return value === "name-desc" || value === "email-asc" || value === "last-login" ? value : "name-asc";
}

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value?: string): PageSizeOption {
  const parsed = Number.parseInt(value ?? "", 10);
  return PAGE_SIZE_OPTIONS.includes(parsed as PageSizeOption) ? (parsed as PageSizeOption) : DEFAULT_PAGE_SIZE;
}

function buildUsersUrl(options?: {
  view?: ViewMode | null;
  roleKey?: string | null;
  editId?: string | null;
  q?: string | null;
  filterRoleKey?: string | null;
  scopeId?: string | null;
  status?: UserStatusFilter | null;
  login?: LoginFilter | null;
  sort?: SortOption | null;
  page?: number | null;
  pageSize?: PageSizeOption | null;
}) {
  const params = new URLSearchParams();
  if (options?.view && options.view !== "roles") params.set("view", options.view);
  if (options?.roleKey) params.set("roleKey", options.roleKey);
  if (options?.editId) params.set("editId", options.editId);
  if (options?.q) params.set("q", options.q);
  if (options?.filterRoleKey) params.set("filterRoleKey", options.filterRoleKey);
  if (options?.scopeId) params.set("scopeId", options.scopeId);
  if (options?.status && options.status !== "all") params.set("status", options.status);
  if (options?.login && options.login !== "all") params.set("login", options.login);
  if (options?.sort && options.sort !== "name-asc") params.set("sort", options.sort);
  if (options?.page && options.page > 1) params.set("page", String(options.page));
  if (options?.pageSize && options.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(options.pageSize));
  const query = params.toString();
  return query ? `/users?${query}` : "/users";
}

function buildRoleFilteredUsersUrl(
  roleKey: string,
  options?: {
    editId?: string | null;
    q?: string | null;
    scopeId?: string | null;
    status?: UserStatusFilter | null;
    login?: LoginFilter | null;
    sort?: SortOption | null;
    page?: number | null;
    pageSize?: PageSizeOption | null;
  },
) {
  return buildUsersUrl({
    view: "users",
    editId: options?.editId ?? null,
    q: options?.q ?? null,
    filterRoleKey: roleKey,
    scopeId: options?.scopeId ?? null,
    status: options?.status ?? null,
    login: options?.login ?? null,
    sort: options?.sort ?? null,
    page: options?.page ?? null,
    pageSize: options?.pageSize ?? null,
  });
}

function filterUsers(users: Awaited<ReturnType<typeof listUsers>>, options: { q: string; roleKey?: string | null; scopeId?: string | null; status: UserStatusFilter; login: LoginFilter; }) {
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

async function updateUserAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const userId = String(formData.get("userId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const allowLogin = String(formData.get("allowLogin") ?? "false") === "true";
  const password = String(formData.get("password") ?? "");
  const roleKey = String(formData.get("roleKey") ?? "").trim();
  const scopeIds = formData.getAll("scopeIds").map((value) => String(value).trim()).filter(Boolean);
  const isActive = String(formData.get("isActive") ?? "true") !== "false";
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
  if (!userId || name.length < 2 || email.length < 3 || !roleKey) return;
  await updateUser({ userId, name, email, allowLogin, password, roleKey, scopeIds, isActive, actorUserId: currentUser.id });
  revalidatePath("/users");
  redirect(buildUsersUrl({ view, roleKey: view === "roles" ? selectedRoleKey || roleKey : null, q: searchQuery || null, filterRoleKey: view === "users" ? filterRoleKey || null : null, scopeId: view === "users" ? scopeId || null : null, status: view === "users" ? status : null, login: view === "users" ? login : null, sort: view === "users" ? sort : null, page: view === "users" ? page : null, pageSize: view === "users" ? pageSize : null }));
}

async function deleteUserAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
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
  if (!userId) return;
  await deleteUser(userId, currentUser.id);
  revalidatePath("/users");
  redirect(buildUsersUrl({ view, roleKey: view === "roles" ? selectedRoleKey || null : null, q: searchQuery || null, filterRoleKey: view === "users" ? filterRoleKey || null : null, scopeId: view === "users" ? scopeId || null : null, status: view === "users" ? status : null, login: view === "users" ? login : null, sort: view === "users" ? sort : null, page: view === "users" ? page : null, pageSize: view === "users" ? pageSize : null }));
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const legacyRoleKey = resolvedSearchParams?.roleKey?.trim() || null;
  const view = parseViewMode(resolvedSearchParams?.view);
  const editUserId = resolvedSearchParams?.editId?.trim() || null;
  const searchQuery = resolvedSearchParams?.q?.trim() || "";
  const filterRoleKey = resolvedSearchParams?.filterRoleKey?.trim() || null;
  const scopeId = resolvedSearchParams?.scopeId?.trim() || null;
  const status = parseStatus(resolvedSearchParams?.status);
  const login = parseLoginFilter(resolvedSearchParams?.login);
  const sort = parseSort(resolvedSearchParams?.sort);
  const requestedPage = parsePage(resolvedSearchParams?.page);
  const pageSize = parsePageSize(resolvedSearchParams?.pageSize);

  if (legacyRoleKey) {
    redirect(buildRoleFilteredUsersUrl(legacyRoleKey, { editId: editUserId, q: searchQuery || null, pageSize }));
  }

  const [setupState, currentUser, users, roles, scopes, editUser] = await Promise.all([
    readSetupState(), getCurrentUser(), listUsers(), listAssignableRoles(), listAssignableScopes(), editUserId ? getUserById(editUserId) : Promise.resolve(null),
  ]);

  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");

  const selectedFilterRole = filterRoleKey ? roles.find((role) => role.key === filterRoleKey) ?? null : null;
  const selectedScope = scopeId ? scopes.find((scope) => scope.id === scopeId) ?? null : null;

  if (view === "users" && filterRoleKey && !selectedFilterRole) redirect(buildUsersUrl({ view: "users", q: searchQuery || null, scopeId, status, login, sort, pageSize }));
  if (view === "users" && scopeId && !selectedScope) redirect(buildUsersUrl({ view: "users", q: searchQuery || null, filterRoleKey, status, login, sort, pageSize }));
  if (editUserId && !editUser) redirect(buildUsersUrl({ view, q: searchQuery || null, filterRoleKey: view === "users" ? filterRoleKey : null, scopeId: view === "users" ? scopeId : null, status: view === "users" ? status : null, login: view === "users" ? login : null, sort: view === "users" ? sort : null, page: view === "users" ? requestedPage : null, pageSize: view === "users" ? pageSize : null }));

  const roleCards = roles.map((role) => {
    const roleUsers = users.filter((user) => user.userRoles.some(({ role: userRole }) => userRole.key === role.key));
    return { ...role, totalUsers: roleUsers.length, activeUsers: roleUsers.filter((user) => user.isActive).length, loginEnabledUsers: roleUsers.filter((user) => user.canLogin).length };
  });

  const filteredUsers = sortUsers(filterUsers(users, { q: searchQuery, roleKey: view === "users" ? filterRoleKey : null, scopeId: view === "users" ? scopeId : null, status, login }), sort);
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

  const summary = view === "roles"
    ? `${roleCards.length} role${roleCards.length === 1 ? "" : "s"} available. Open a card to browse members in the standard user directory.`
    : totalUsers === 0
      ? selectedFilterRole
        ? `No users matched the current filters for ${selectedFilterRole.name}.`
        : "No users matched the current filters."
      : selectedFilterRole
        ? `Showing ${pageStart}-${pageEnd} of ${totalUsers} users in ${selectedFilterRole.name}.`
        : `Showing ${pageStart}-${pageEnd} of ${totalUsers} users.`;

  const rolesViewHref = buildUsersUrl({ view: "roles" });
  const usersViewHref = buildUsersUrl({ view: "users", q: searchQuery || null, filterRoleKey, scopeId, status, login, sort, page: currentPage, pageSize });
  const editCloseHref = buildUsersUrl({ view, q: searchQuery || null, filterRoleKey: view === "users" ? filterRoleKey : null, scopeId: view === "users" ? scopeId : null, status: view === "users" ? status : null, login: view === "users" ? login : null, sort: view === "users" ? sort : null, page: view === "users" ? currentPage : null, pageSize: view === "users" ? pageSize : null });

  return (
    <AppShell>
      <div className="space-y-6">
        <UsersHeader rolesViewHref={rolesViewHref} selectedRoleName={null} usersViewHref={usersViewHref} view={view} />

        <section className="space-y-6">
          {editUser ? (
            <UserEditCard
              action={updateUserAction}
              closeHref={editCloseHref}
              editUser={editUser}
              filterRoleKey={filterRoleKey ?? ""}
              login={login}
              page={currentPage}
              pageSize={pageSize}
              roleOptions={roles}
              scopeId={scopeId ?? ""}
              scopeOptions={scopes}
              searchQuery={searchQuery}
              selectedRoleKey={editUser.userRoles[0]?.role.key ?? ""}
              sort={sort}
              status={status}
              view={view}
            />
          ) : null}

          <PanelCard>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">{view === "users" ? selectedFilterRole ? `${selectedFilterRole.name} users` : "All users" : "Roles"}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{summary}</p>
              </div>
              {view === "users" ? (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedFilterRole ? <Link href={rolesViewHref}><Button type="button" variant="ghost">Back to roles</Button></Link> : null}
                  <Link href={USERS_NEW_HREF}><Button type="button">New user</Button></Link>
                </div>
              ) : null}
            </div>
            <div className="mt-5">
              {view === "roles" ? (
                <RoleCardsGrid buildMemberHref={(roleKey) => buildRoleFilteredUsersUrl(roleKey)} roleCards={roleCards} />
              ) : (
                <div className="space-y-4">
                  <UsersFilterBar filterRoleKey={filterRoleKey} login={login} pageSize={pageSize} resetHref={USERS_DIRECTORY_HREF} roles={roles} scopeId={scopeId} scopes={scopes} searchQuery={searchQuery} sort={sort} status={status} />
                  <UsersDirectoryList
                    buildEditHref={(userId) => buildUsersUrl({ view: "users", editId: userId, q: searchQuery || null, filterRoleKey, scopeId, status, login, sort, page: currentPage, pageSize })}
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
                        <Button className={canDelete ? "rounded-2xl px-3 py-1.5 text-xs hover:bg-red-600 hover:text-white hover:ring-red-600 dark:hover:bg-red-500" : "rounded-2xl bg-emerald-100 px-3 py-1.5 text-xs text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-900/70 dark:hover:bg-emerald-500/25"} disabled={!canDelete} type="submit" variant="secondary">{userId === currentUser.id ? "Current user" : canDelete ? "Delete" : "In use"}</Button>
                      </form>
                    )}
                    totalPages={totalPages}
                    totalUsers={totalUsers}
                    users={paginatedUsers}
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
