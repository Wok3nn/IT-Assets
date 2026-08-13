export const BORROWED_ITEMS_HREF = "/borrowed-items";
export const BORROWED_ITEMS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type BorrowedItemsStatusFilter = "active" | "due-today" | "overdue" | "returned";
export type BorrowedItemsPageSize = (typeof BORROWED_ITEMS_PAGE_SIZE_OPTIONS)[number];

export type BorrowedItemsFilterState = {
  q?: string | null;
  status?: BorrowedItemsStatusFilter | null;
  page?: number | null;
  pageSize?: BorrowedItemsPageSize | null;
};

export function parseBorrowedItemsStatus(value?: string): BorrowedItemsStatusFilter {
  return value === "due-today" || value === "overdue" || value === "returned" ? value : "active";
}

export function parseBorrowedItemsPage(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseBorrowedItemsPageSize(value?: string): BorrowedItemsPageSize {
  const parsed = Number.parseInt(value ?? "", 10);
  return BORROWED_ITEMS_PAGE_SIZE_OPTIONS.includes(parsed as BorrowedItemsPageSize)
    ? (parsed as BorrowedItemsPageSize)
    : 25;
}

export function buildBorrowedItemsUrl(options?: BorrowedItemsFilterState) {
  const params = new URLSearchParams();

  if (options?.q) params.set("q", options.q);
  if (options?.status && options.status !== "active") params.set("status", options.status);
  if (options?.pageSize && options.pageSize !== 25) params.set("pageSize", String(options.pageSize));
  if (options?.page && options.page > 1) params.set("page", String(options.page));

  const query = params.toString();
  return query ? `${BORROWED_ITEMS_HREF}?${query}` : BORROWED_ITEMS_HREF;
}
