export type ViewMode = "roles" | "users";
export type UserStatusFilter = "all" | "active" | "inactive";
export type LoginFilter = "all" | "enabled" | "disabled";
export type SortOption = "name-asc" | "name-desc" | "email-asc" | "last-login";
export type PageSizeOption = 25 | 50;

export const DEFAULT_PAGE_SIZE: PageSizeOption = 25;
export const PAGE_SIZE_OPTIONS: PageSizeOption[] = [25, 50];
export const USERS_DIRECTORY_HREF = "/users?view=users";
export const USERS_NEW_HREF = "/users/new";

export function parseViewMode(value?: string): ViewMode {
  return value === "users" ? "users" : "roles";
}

export function parseStatus(value?: string): UserStatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

export function parseLoginFilter(value?: string): LoginFilter {
  return value === "enabled" || value === "disabled" ? value : "all";
}

export function parseSort(value?: string): SortOption {
  return value === "name-desc" || value === "email-asc" || value === "last-login" ? value : "name-asc";
}

export function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parsePageSize(value?: string): PageSizeOption {
  const parsed = Number.parseInt(value ?? "", 10);
  return PAGE_SIZE_OPTIONS.includes(parsed as PageSizeOption) ? (parsed as PageSizeOption) : DEFAULT_PAGE_SIZE;
}

export function buildUsersUrl(options?: {
  view?: ViewMode | null;
  roleKey?: string | null;
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

export function buildRoleFilteredUsersUrl(
  roleKey: string,
  options?: {
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

export function buildUserEditHref(userId: string, returnTo: string) {
  const params = new URLSearchParams({ returnTo });
  return `/users/${userId}/edit?${params.toString()}`;
}

export function normalizeUsersReturnTo(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (trimmed && trimmed.startsWith("/users")) {
    return trimmed;
  }

  return USERS_DIRECTORY_HREF;
}
