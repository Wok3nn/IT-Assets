import Link from "next/link";

import { Button } from "@/components/ui/button";

import { usersFieldClassName } from "./users.styles";

type UserStatusFilter = "all" | "active" | "inactive";
type LoginFilter = "all" | "enabled" | "disabled";
type SortOption = "name-asc" | "name-desc" | "email-asc" | "last-login";

type RoleOption = { id: string; key: string; name: string };
type ScopeOption = { id: string; name: string };

export function UsersFilterBar({
  searchQuery,
  filterRoleKey,
  scopeId,
  status,
  login,
  sort,
  roles,
  scopes,
  resetHref,
}: {
  searchQuery: string;
  filterRoleKey: string | null;
  scopeId: string | null;
  status: UserStatusFilter;
  login: LoginFilter;
  sort: SortOption;
  roles: RoleOption[];
  scopes: ScopeOption[];
  resetHref: string;
}) {
  return (
    <form action="/users" className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))]">
      <input name="view" type="hidden" value="users" />
      <input defaultValue={searchQuery} className={usersFieldClassName} name="q" placeholder="Search by name or email" type="search" />
      <select defaultValue={filterRoleKey ?? ""} name="filterRoleKey" className={usersFieldClassName}><option value="">All roles</option>{roles.map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}</select>
      <select defaultValue={scopeId ?? ""} name="scopeId" className={usersFieldClassName}><option value="">All departments</option>{scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}</select>
      <select defaultValue={status} name="status" className={usersFieldClassName}><option value="all">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <select defaultValue={login} name="login" className={usersFieldClassName}><option value="all">Any login access</option><option value="enabled">Login enabled</option><option value="disabled">Login disabled</option></select>
      <select defaultValue={sort} name="sort" className={usersFieldClassName}><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="email-asc">Email A-Z</option><option value="last-login">Recent login</option></select>
      <div className="flex gap-3 lg:col-span-full"><Button type="submit">Apply filters</Button><Link href={resetHref}><Button type="button" variant="ghost">Reset</Button></Link></div>
    </form>
  );
}
