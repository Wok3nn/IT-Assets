import type { AssetSortOption } from "@/modules/assets/asset.service";

export const ASSET_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type AssetPageSize = (typeof ASSET_PAGE_SIZE_OPTIONS)[number];
export const ASSET_BULK_EDIT_HREF = "/assets/bulk-edit";

export type AssetsFilterState = {
  q?: string | null;
  statusId?: string | null;
  categoryId?: string | null;
  scopeId?: string | null;
  locationId?: string | null;
  userId?: string | null;
  includeRetired?: boolean | null;
  sort?: AssetSortOption | null;
  page?: number | null;
  pageSize?: AssetPageSize | null;
};

export function parseAssetsSort(value?: string): AssetSortOption {
  return value === "tag-asc" || value === "tag-desc" || value === "model-asc" || value === "model-desc" ? value : "updated-desc";
}

export function parseAssetsPage(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAssetsPageSize(value?: string): AssetPageSize {
  const parsed = Number.parseInt(value ?? "", 10);
  return ASSET_PAGE_SIZE_OPTIONS.includes(parsed as AssetPageSize) ? (parsed as AssetPageSize) : 25;
}

export function parseAssetsIncludeRetired(value?: string) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

export function buildAssetsUrl(options?: AssetsFilterState) {
  const params = new URLSearchParams();

  if (options?.q) params.set("q", options.q);
  if (options?.statusId) params.set("statusId", options.statusId);
  if (options?.categoryId) params.set("categoryId", options.categoryId);
  if (options?.scopeId) params.set("scopeId", options.scopeId);
  if (options?.locationId) params.set("locationId", options.locationId);
  if (options?.userId) params.set("userId", options.userId);
  if (options?.includeRetired) params.set("includeRetired", "true");
  if (options?.sort && options.sort !== "updated-desc") params.set("sort", options.sort);
  if (options?.pageSize && options.pageSize !== 25) params.set("pageSize", String(options.pageSize));
  if (options?.page && options.page > 1) params.set("page", String(options.page));

  const query = params.toString();
  return query ? `/assets?${query}` : "/assets";
}

export function normalizeAssetsReturnTo(value?: string | null) {
  if (value && value.startsWith("/assets")) {
    return value;
  }

  return "/assets";
}

export function parseAssetIdsParam(value?: string | string[] | null) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

export function buildAssetHref(
  assetId: string,
  options?: {
    section?: "view" | "edit" | "history";
    transfer?: "checkin" | "checkout" | null;
    returnTo?: string | null;
    days?: string | null;
  },
) {
  const section = options?.section ?? "view";
  const basePath = section === "view"
    ? `/assets/${assetId}`
    : section === "edit"
      ? `/assets/${assetId}/edit`
      : `/assets/${assetId}/history`;

  const params = new URLSearchParams();
  const returnTo = normalizeAssetsReturnTo(options?.returnTo);

  if (options?.transfer) params.set("transfer", options.transfer);
  if (options?.days && section === "history") params.set("days", options.days);
  if (returnTo !== "/assets") params.set("returnTo", returnTo);

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function buildAssetLabelHref(assetId: string) {
  return `/assets/${assetId}/label`;
}

export function buildAssetLookupPath(assetId: string) {
  return "/lookup/assets/" + assetId;
}

export function buildAssetLookupUrl(assetId: string, baseUrl?: string | null) {
  const path = buildAssetLookupPath(assetId);
  const appUrl = baseUrl?.trim() || process.env.APP_URL?.trim();

  if (!appUrl) {
    return path;
  }

  return appUrl.endsWith("/") ? appUrl.slice(0, -1) + path : appUrl + path;
}
