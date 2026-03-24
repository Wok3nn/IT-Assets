import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { RoleCardsGrid } from "@/modules/users/components/role-cards-grid";
import { RoleMembersList } from "@/modules/users/components/role-members-list";
import { UserCreateCard } from "@/modules/users/components/user-create-card";
import { UserEditCard } from "@/modules/users/components/user-edit-card";
import { UsersDirectoryList } from "@/modules/users/components/users-directory-list";
import { UsersFilterBar } from "@/modules/users/components/users-filter-bar";
import { UsersHeader } from "@/modules/users/components/users-header";
import {
  createUser,
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
  const query = params.toString();
  return query ? `/users?${query}` : "/users";
}

function buildMemberViewUrl(roleKey: string, options?: { q?: string | null; editId?: string | null }) {
  return buildUsersUrl({ view: "roles", roleKey, q: options?.q ?? null, editId: options?.editId ?? null });
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

async function createUserAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const allowLogin = String(formData.get("allowLogin") ?? "false") === "true";
  const password = String(formData.get("password") ?? "");
  const roleKey = String(formData.get("roleKey") ?? "").trim();
  const scopeIds = formData.getAll("scopeIds").map((value) => String(value).trim()).filter(Boolean);
  const isActive = String(formData.get("isActive") ?? "true") !== "false";
  if (name.length < 2 || email.length < 3 || !roleKey) return;
  await createUser({ name, email, allowLogin, password, roleKey, scopeIds, isActive });
  revalidatePath("/users");
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
  if (!userId || name.length < 2 || email.length < 3 || !roleKey) return;
  await updateUser({ userId, name, email, allowLogin, password, roleKey, scopeIds, isActive, actorUserId: currentUser.id });
  revalidatePath("/users");
  redirect(buildUsersUrl({ view, roleKey: view === "roles" ? selectedRoleKey || roleKey : null, q: searchQuery || null, filterRoleKey: view === "users" ? filterRoleKey || null : null, scopeId: view === "users" ? scopeId || null : null, status: view === "users" ? status : null, login: view === "users" ? login : null, sort: view === "users" ? sort : null }));
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
  if (!userId) return;
  await deleteUser(userId, currentUser.id);
  revalidatePath("/users");
  redirect(buildUsersUrl({ view, roleKey: view === "roles" ? selectedRoleKey || null : null, q: searchQuery || null, filterRoleKey: view === "users" ? filterRoleKey || null : null, scopeId: view === "users" ? scopeId || null : null, status: view === "users" ? status : null, login: view === "users" ? login : null, sort: view === "users" ? sort : null }));
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = parseViewMode(resolvedSearchParams?.view);
  const selectedRoleKey = resolvedSearchParams?.roleKey?.trim() || null;
  const editUserId = resolvedSearchParams?.editId?.trim() || null;
  const searchQuery = resolvedSearchParams?.q?.trim() || "";
  const filterRoleKey = resolvedSearchParams?.filterRoleKey?.trim() || null;
  const scopeId = resolvedSearchParams?.scopeId?.trim() || null;
  const status = parseStatus(resolvedSearchParams?.status);
  const login = parseLoginFilter(resolvedSearchParams?.login);
  const sort = parseSort(resolvedSearchParams?.sort);

  const [setupState, currentUser, users, roles, scopes, editUser] = await Promise.all([
    readSetupState(), getCurrentUser(), listUsers(), listAssignableRoles(), listAssignableScopes(), editUserId ? getUserById(editUserId) : Promise.resolve(null),
  ]);

  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");

  const selectedRole = selectedRoleKey ? roles.find((role) => role.key === selectedRoleKey) ?? null : null;
  const selectedFilterRole = filterRoleKey ? roles.find((role) => role.key === filterRoleKey) ?? null : null;
  const selectedScope = scopeId ? scopes.find((scope) => scope.id === scopeId) ?? null : null;

  if (view === "roles" && selectedRoleKey && !selectedRole) redirect(buildUsersUrl({ view: "roles" }));
  if (view === "users" && filterRoleKey && !selectedFilterRole) redirect(buildUsersUrl({ view: "users", q: searchQuery || null, scopeId, status, login, sort }));
  if (view === "users" && scopeId && !selectedScope) redirect(buildUsersUrl({ view: "users", q: searchQuery || null, filterRoleKey, status, login, sort }));
  if (editUserId && !editUser) redirect(buildUsersUrl({ view, roleKey: view === "roles" ? selectedRoleKey : null, q: searchQuery || null, filterRoleKey: view === "users" ? filterRoleKey : null, scopeId: view === "users" ? scopeId : null, status: view === "users" ? status : null, login: view === "users" ? login : null, sort: view === "users" ? sort : null }));
  if (view === "roles" && !selectedRole && editUser && editUser.userRoles[0]?.role.key) redirect(buildMemberViewUrl(editUser.userRoles[0].role.key, { editId: editUser.id }));

  const roleCards = roles.map((role) => {
    const roleUsers = users.filter((user) => user.userRoles.some(({ role: userRole }) => userRole.key === role.key));
    return { ...role, totalUsers: roleUsers.length, activeUsers: roleUsers.filter((user) => user.isActive).length, loginEnabledUsers: roleUsers.filter((user) => user.canLogin).length };
  });

  const roleMembers = selectedRole ? sortUsers(filterUsers(users, { q: searchQuery, roleKey: selectedRole.key, status: "all", login: "all" }), "name-asc") : [];
  const filteredUsers = sortUsers(filterUsers(users, { q: searchQuery, roleKey: view === "users" ? filterRoleKey : null, scopeId: view === "users" ? scopeId : null, status, login }), sort);

  const summary = view === "roles"
    ? selectedRole
      ? roleMembers.length === 0
        ? searchQuery ? `No users matched "${searchQuery}" in ${selectedRole.name}.` : `No users are currently assigned to ${selectedRole.name}.`
        : `${roleMembers.length} user${roleMembers.length === 1 ? "" : "s"} shown in ${selectedRole.name}.`
      : `${roleCards.length} role${roleCards.length === 1 ? "" : "s"} available. Open a card to see its members.`
    : filteredUsers.length === 0
      ? "No users matched the current filters."
      : `${filteredUsers.length} user${filteredUsers.length === 1 ? "" : "s"} shown with the current filters.`;

  const rolesViewHref = buildUsersUrl({ view: "roles" });
  const usersViewHref = buildUsersUrl({ view: "users", q: searchQuery || null, filterRoleKey, scopeId, status, login, sort });
  const editCloseHref = buildUsersUrl({ view, roleKey: view === "roles" ? selectedRole?.key ?? editUser?.userRoles[0]?.role.key ?? null : null, q: searchQuery || null, filterRoleKey: view === "users" ? filterRoleKey : null, scopeId: view === "users" ? scopeId : null, status: view === "users" ? status : null, login: view === "users" ? login : null, sort: view === "users" ? sort : null });

  return (
    <AppShell>
      <div className="space-y-6">
        <UsersHeader rolesViewHref={rolesViewHref} selectedRoleName={selectedRole?.name ?? null} usersViewHref={usersViewHref} view={view} />

        <section className="grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-6">
            <UserCreateCard action={createUserAction} defaultRoleKey={selectedRole?.key ?? selectedFilterRole?.key ?? roles[0]?.key ?? ""} roleOptions={roles} scopeOptions={scopes} />

            {editUser ? (
              <UserEditCard
                action={updateUserAction}
                closeHref={editCloseHref}
                editUser={editUser}
                filterRoleKey={filterRoleKey ?? ""}
                login={login}
                roleOptions={roles}
                scopeId={scopeId ?? ""}
                scopeOptions={scopes}
                searchQuery={searchQuery}
                selectedRoleKey={selectedRole?.key ?? editUser.userRoles[0]?.role.key ?? ""}
                sort={sort}
                status={status}
                view={view}
              />
            ) : null}
          </div>

          <PanelCard>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">{view === "roles" ? (selectedRole ? `${selectedRole.name} users` : "Roles") : "All users"}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{summary}</p></div>{view === "roles" && selectedRole ? <Link href={buildUsersUrl({ view: "roles" })}><Button type="button" variant="ghost">Back to roles</Button></Link> : null}</div>
            <div className="mt-5">
              {view === "roles" ? (
                !selectedRole ? (
                  <RoleCardsGrid buildMemberHref={(roleKey) => buildMemberViewUrl(roleKey)} roleCards={roleCards} />
                ) : (
                  <RoleMembersList
                    buildEditHref={(userId) => buildMemberViewUrl(selectedRole.key, { editId: userId, q: searchQuery || null })}
                    currentUserId={currentUser.id}
                    onDelete={(userId) => {
                      const user = roleMembers.find((item) => item.id === userId);
                      const canDelete = Boolean(user && user.id !== currentUser.id && user._count.assets === 0 && user._count.auditEntries === 0);
                      return (
                        <form action={deleteUserAction}>
                          <input name="userId" type="hidden" value={userId} />
                          <input name="view" type="hidden" value="roles" />
                          <input name="selectedRoleKey" type="hidden" value={selectedRole.key} />
                          <input name="q" type="hidden" value={searchQuery} />
                          <Button className={canDelete ? "w-full rounded-2xl hover:bg-red-600 hover:text-white hover:ring-red-600 dark:hover:bg-red-500" : "w-full rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-900/70 dark:hover:bg-emerald-500/25"} disabled={!canDelete} type="submit" variant="secondary">{userId === currentUser.id ? "Current user" : canDelete ? "Delete" : "In use"}</Button>
                        </form>
                      );
                    }}
                    roleMembers={roleMembers}
                    searchQuery={searchQuery}
                    selectedRoleName={selectedRole.name}
                    selectedRoleKey={selectedRole.key}
                  />
                )
              ) : (
                <div className="space-y-4">
                  <UsersFilterBar filterRoleKey={filterRoleKey} login={login} resetHref={buildUsersUrl({ view: "users" })} roles={roles} scopeId={scopeId} scopes={scopes} searchQuery={searchQuery} sort={sort} status={status} />
                  <UsersDirectoryList
                    buildEditHref={(userId) => buildUsersUrl({ view: "users", editId: userId, q: searchQuery || null, filterRoleKey, scopeId, status, login, sort })}
                    currentUserId={currentUser.id}
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
                        <Button className={canDelete ? "rounded-2xl hover:bg-red-600 hover:text-white hover:ring-red-600 dark:hover:bg-red-500" : "rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-900/70 dark:hover:bg-emerald-500/25"} disabled={!canDelete} type="submit" variant="secondary">{userId === currentUser.id ? "Current user" : canDelete ? "Delete" : "In use"}</Button>
                      </form>
                    )}
                    users={filteredUsers}
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

