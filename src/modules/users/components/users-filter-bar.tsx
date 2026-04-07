import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { usersFieldClassName } from "./users.styles";

type UserStatusFilter = "all" | "active" | "inactive";
type LoginFilter = "all" | "enabled" | "disabled";
type SortOption = "name-asc" | "name-desc" | "email-asc" | "last-login";
type PageSizeOption = 25 | 50;

type RoleOption = { id: string; key: string; name: string };
type ScopeOption = { id: string; name: string };

function FilterSelect({
  children,
  defaultValue,
  name,
}: {
  children: ReactNode;
  defaultValue: string;
  name: string;
}) {
  return (
    <select defaultValue={defaultValue} name={name} className={`${usersFieldClassName} w-full`}>
      {children}
    </select>
  );
}

export function UsersFilterBar({
  searchQuery,
  filterRoleKey,
  scopeId,
  status,
  login,
  sort,
  pageSize,
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
  pageSize: PageSizeOption;
  roles: RoleOption[];
  scopes: ScopeOption[];
  resetHref: string;
}) {
  return (
    <form action="/users" className="space-y-3" key="users-filter-form">
      <input name="view" readOnly type="hidden" value="users" />
      <input name="page" readOnly type="hidden" value="1" />
      <input name="pageSize" readOnly type="hidden" value={pageSize} />

      <div className="w-full">
        <input
          defaultValue={searchQuery ?? ""}
          className={`${usersFieldClassName} w-full`}
          name="q"
          placeholder="Search by name or email"
          type="search"
        />
      </div>

      <div className="grid grid-cols-5 gap-3">
        <FilterSelect defaultValue={filterRoleKey ?? ""} name="filterRoleKey">
          <option value="">All roles</option>
          {roles.map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}
        </FilterSelect>

        <FilterSelect defaultValue={scopeId ?? ""} name="scopeId">
          <option value="">All departments</option>
          {scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}
        </FilterSelect>

        <FilterSelect defaultValue={status} name="status">
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </FilterSelect>

        <FilterSelect defaultValue={login} name="login">
          <option value="all">Any login access</option>
          <option value="enabled">Login enabled</option>
          <option value="disabled">Login disabled</option>
        </FilterSelect>

        <FilterSelect defaultValue={sort} name="sort">
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="email-asc">Email A-Z</option>
          <option value="last-login">Recent login</option>
        </FilterSelect>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button className="whitespace-nowrap" type="submit">Apply filters</Button>
        <Link href={resetHref}><Button className="whitespace-nowrap" type="button" variant="ghost">Reset</Button></Link>
      </div>
    </form>
  );
}
