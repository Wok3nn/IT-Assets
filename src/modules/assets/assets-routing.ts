import type { AssetSortOption } from "@/modules/assets/asset.service";

export type AssetsFilterState = {
  q?: string | null;
  statusId?: string | null;
  categoryId?: string | null;
  scopeId?: string | null;
  locationId?: string | null;
  userId?: string | null;
  sort?: AssetSortOption | null;
};

export function parseAssetsSort(value?: string): AssetSortOption {
  return value === "name-asc" || value === "tag-asc" || value === "purchase-desc" ? value : "updated-desc";
}

export function buildAssetsUrl(options?: AssetsFilterState) {
  const params = new URLSearchParams();

  if (options?.q) params.set("q", options.q);
  if (options?.statusId) params.set("statusId", options.statusId);
  if (options?.categoryId) params.set("categoryId", options.categoryId);
  if (options?.scopeId) params.set("scopeId", options.scopeId);
  if (options?.locationId) params.set("locationId", options.locationId);
  if (options?.userId) params.set("userId", options.userId);
  if (options?.sort && options.sort !== "updated-desc") params.set("sort", options.sort);

  const query = params.toString();
  return query ? `/assets?${query}` : "/assets";
}

export function normalizeAssetsReturnTo(value?: string | null) {
  if (value && value.startsWith("/assets")) {
    return value;
  }

  return "/assets";
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
