"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { SearchCombobox, type SearchComboboxOption } from "@/components/forms/search-combobox";
import { textFieldClassName } from "@/components/forms/text-field";
import { textareaFieldClassName } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { buildAssetHref } from "@/modules/assets/assets-routing";
import {
  BORROWED_ITEMS_PAGE_SIZE_OPTIONS,
  buildBorrowedItemsUrl,
  type BorrowedItemsPageSize,
  type BorrowedItemsStatusFilter,
} from "@/modules/borrowed-items/borrowed-items-routing";
import { formatDateTimeLocalInput, getBorrowedItemStatus, type BorrowedItemListRecord } from "@/modules/borrowed-items/borrowed-items.shared";
import { buildUserHref } from "@/modules/users/users-routing";

export type BorrowedItemsActionState = {
  ok: boolean;
  message: string;
};

type BorrowerOption = {
  id: string;
  name: string;
  email: string;
};

type BorrowableAssetOption = {
  id: string;
  assetTag: string;
  name: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  category: { name: string } | null;
};

type BorrowedItemsPanelProps = {
  assets: BorrowableAssetOption[];
  borrowers: BorrowerOption[];
  canManageBorrowedItems: boolean;
  createAction: (state: BorrowedItemsActionState, formData: FormData) => Promise<BorrowedItemsActionState>;
  defaultBorrowedAt: string;
  items: BorrowedItemListRecord[];
  markReturnedAction: (state: BorrowedItemsActionState, formData: FormData) => Promise<BorrowedItemsActionState>;
  page: number;
  pageSize: BorrowedItemsPageSize;
  query: string;
  status: BorrowedItemsStatusFilter;
  totalCount: number;
  totalPages: number;
};

const statusFilters: Array<{ key: BorrowedItemsStatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "due-today", label: "Due Today" },
  { key: "overdue", label: "Overdue" },
  { key: "returned", label: "Returned" },
];

const dialogOverlayClassName = "fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px] dark:bg-black/35";

function BorrowedItemsDialogLayer({
  children,
  className,
  onClose,
}: {
  children: ReactNode;
  className: string;
  onClose: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      className={dialogOverlayClassName}
      onClick={onClose}
      role="dialog"
    >
      <div className={className} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function getItemLabel(item: BorrowedItemListRecord) {
  if (item.asset) {
    return item.asset.model?.trim() || item.asset.name.trim() || item.asset.assetTag;
  }

  return item.itemName ?? "Manual item";
}

function formatDateTimeLabel(value?: Date | null) {
  return value ? value.toLocaleString() : "Not recorded";
}

function formatNotificationTypeLabel(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function NotificationStatusPill({ status }: { status: string }) {
  const className = status === "SENT"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : status === "FAILED"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#596166] dark:bg-[#2f3437] dark:text-slate-300";

  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>{status}</span>;
}

function StatusPill({ label }: { label: string }) {
  const className = label === "Returned"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : label === "Overdue"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
      : label === "Due Today"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

function BorrowItemDialog({
  action,
  assets,
  borrowers,
  defaultBorrowedAt,
}: {
  action: BorrowedItemsPanelProps["createAction"];
  assets: BorrowableAssetOption[];
  borrowers: BorrowerOption[];
  defaultBorrowedAt: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [itemType, setItemType] = useState<"asset" | "manual">("asset");
  const [selectedAsset, setSelectedAsset] = useState<SearchComboboxOption | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<SearchComboboxOption | null>(null);
  const [state, formAction, isPending] = useActionState(action, { ok: false, message: "" });

  const assetOptions = useMemo<SearchComboboxOption[]>(
    () => assets.map((asset) => ({
      id: asset.id,
      label: `${asset.assetTag} - ${asset.model?.trim() || asset.name}`,
      description: [asset.make, asset.serialNumber, asset.category?.name].filter(Boolean).join(" / "),
      kind: "Asset",
      searchText: [asset.assetTag, asset.name, asset.make, asset.model, asset.serialNumber, asset.category?.name].filter(Boolean).join(" "),
    })),
    [assets],
  );
  const borrowerOptions = useMemo<SearchComboboxOption[]>(
    () => borrowers.map((borrower) => ({
      id: borrower.id,
      label: borrower.name,
      description: borrower.email,
      kind: "User",
    })),
    [borrowers],
  );

  function closeDialog() {
    setIsOpen(false);
    setSelectedAsset(null);
    setSelectedBorrower(null);
    setItemType("asset");
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button">Borrow Item</Button>
      {isOpen ? (
        <BorrowedItemsDialogLayer
          className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-2xl dark:border-[#4b5255] dark:bg-[#2f3437]"
          onClose={closeDialog}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Borrowed Items</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">Borrow item</h2>
              </div>
              <Button onClick={closeDialog} type="button" variant="ghost">Cancel</Button>
            </div>

            <form action={formAction} className="mt-5 space-y-4">
              <input name="itemType" type="hidden" value={itemType} />
              <input name="assetId" type="hidden" value={itemType === "asset" ? selectedAsset?.id ?? "" : ""} />
              <input name="borrowerUserId" type="hidden" value={selectedBorrower?.id ?? ""} />

              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-[#4b5255] dark:bg-[#34393c]">
                <button
                  className={itemType === "asset" ? "rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-950 shadow-sm dark:bg-[#2f3437] dark:text-slate-100" : "rounded-xl px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-300"}
                  onClick={() => {
                    setItemType("asset");
                    setSelectedAsset(null);
                  }}
                  type="button"
                >
                  Existing Asset
                </button>
                <button
                  className={itemType === "manual" ? "rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-950 shadow-sm dark:bg-[#2f3437] dark:text-slate-100" : "rounded-xl px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-300"}
                  onClick={() => {
                    setItemType("manual");
                    setSelectedAsset(null);
                  }}
                  type="button"
                >
                  Other Item
                </button>
              </div>

              {itemType === "asset" ? (
                <SearchCombobox
                  emptyMessage="No available assets match that search."
                  label="Asset"
                  onChange={setSelectedAsset}
                  options={assetOptions}
                  placeholder="Search asset tag, model, serial number"
                  value={selectedAsset?.id ?? null}
                />
              ) : (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Item name</span>
                  <input className={textFieldClassName} maxLength={160} name="itemName" placeholder="USB-C Charger" />
                </label>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Quantity</span>
                  <input className={textFieldClassName} defaultValue={itemType === "asset" ? 1 : 1} min={1} name="quantity" readOnly={itemType === "asset"} type="number" />
                </label>
                <SearchCombobox
                  emptyMessage="No users match that search."
                  label="Borrower"
                  onChange={setSelectedBorrower}
                  options={borrowerOptions}
                  placeholder="Search users"
                  value={selectedBorrower?.id ?? null}
                />
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Borrowed date</span>
                  <input className={textFieldClassName} defaultValue={defaultBorrowedAt} name="borrowedAt" type="datetime-local" />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Expected return date</span>
                  <input className={textFieldClassName} name="dueAt" required type="datetime-local" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Notes</span>
                <textarea className={textareaFieldClassName} maxLength={2000} name="notes" placeholder="Optional notes" rows={3} />
              </label>

              {state.message ? (
                <div className={state.ok ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"}>
                  {state.message}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button disabled={isPending} type="submit">{isPending ? "Saving..." : "Save borrowing"}</Button>
                <Button onClick={closeDialog} type="button" variant="ghost">Close</Button>
              </div>
            </form>
        </BorrowedItemsDialogLayer>
      ) : null}
    </>
  );
}

function MarkReturnedButton({
  action,
  item,
}: {
  action: BorrowedItemsPanelProps["markReturnedAction"];
  item: BorrowedItemListRecord;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(action, { ok: false, message: "" });
  const [isTransitioning, startTransition] = useTransition();

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button" variant="secondary">Mark Returned</Button>
      {isOpen ? (
        <BorrowedItemsDialogLayer
          className="w-full max-w-md rounded-[28px] border border-[#ece7df] bg-white p-5 shadow-2xl dark:border-[#4b5255] dark:bg-[#2f3437]"
          onClose={() => setIsOpen(false)}
        >
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Mark returned</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{getItemLabel(item)}</p>
            <form
              action={(formData) => {
                startTransition(() => formAction(formData));
              }}
              className="mt-5 space-y-4"
            >
              <input name="borrowedItemId" type="hidden" value={item.id} />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Returned date</span>
                <input className={textFieldClassName} defaultValue={formatDateTimeLocalInput(new Date())} name="returnedAt" required type="datetime-local" />
              </label>
              {state.message ? (
                <div className={state.ok ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"}>
                  {state.message}
                </div>
              ) : null}
              <div className="flex gap-3">
                <Button disabled={isPending || isTransitioning} type="submit">{isPending || isTransitioning ? "Saving..." : "Confirm return"}</Button>
                <Button onClick={() => setIsOpen(false)} type="button" variant="ghost">Cancel</Button>
              </div>
            </form>
        </BorrowedItemsDialogLayer>
      ) : null}
    </>
  );
}

export function BorrowedItemsPanel({
  assets,
  borrowers,
  canManageBorrowedItems,
  createAction,
  defaultBorrowedAt,
  items,
  markReturnedAction,
  page,
  pageSize,
  query,
  status,
  totalCount,
  totalPages,
}: BorrowedItemsPanelProps) {
  const visibleStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const visibleEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Borrowing records</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Showing {visibleStart}-{visibleEnd} of {totalCount} borrowed item record{totalCount === 1 ? "" : "s"}.</p>
        </div>
        {canManageBorrowedItems ? (
          <BorrowItemDialog action={createAction} assets={assets} borrowers={borrowers} defaultBorrowedAt={defaultBorrowedAt} />
        ) : null}
      </div>

      <form action="/borrowed-items" className="grid gap-3 rounded-[26px] border border-[#ece7df] bg-white/80 p-3 dark:border-[#4b5255] dark:bg-[#34393c]/80 md:grid-cols-[minmax(0,1fr)_180px_160px_auto]">
        <input className={`${textFieldClassName} min-w-0 px-3 py-2.5 text-xs`} defaultValue={query} name="q" placeholder="Search item, borrower, issuer" type="search" />
        <select className={`${textFieldClassName} min-w-0 px-3 py-2.5 text-xs`} defaultValue={status} name="status">
          {statusFilters.map((filter) => <option key={filter.key} value={filter.key}>{filter.label}</option>)}
        </select>
        <select className={`${textFieldClassName} min-w-0 px-3 py-2.5 text-xs`} defaultValue={String(pageSize)} name="pageSize">
          {BORROWED_ITEMS_PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option} per page</option>)}
        </select>
        <div className="flex items-center gap-3 md:justify-end">
          <Button className="whitespace-nowrap" type="submit">Apply</Button>
          <Link href="/borrowed-items"><Button className="whitespace-nowrap" type="button" variant="ghost">Reset</Button></Link>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <Link key={filter.key} href={buildBorrowedItemsUrl({ q: query || null, status: filter.key, pageSize })}>
            <Button type="button" variant={status === filter.key ? "primary" : "secondary"}>{filter.label}</Button>
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#ece7df] bg-[#f8f9fb] px-5 py-8 text-center text-sm text-slate-500 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-400">
          No borrowed items match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-[#ece7df] dark:border-[#4b5255]">
          <div className="w-full overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-[#f8f9fb] dark:bg-[#34393c]">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Item</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Quantity</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Borrower</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Borrowed</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Expected Return</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Issued By</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white/96 dark:divide-slate-800 dark:bg-[#34393c]">
                {items.map((item) => {
                  const statusLabel = getBorrowedItemStatus(item);

                  return (
                    <tr key={item.id} className="align-middle">
                      <td className="px-4 py-3">
                        {item.asset ? (
                          <Link className="font-semibold text-[#b56613] underline-offset-4 transition hover:underline dark:text-[#ffd7ab]" href={buildAssetHref(item.asset.id)}>
                            {item.asset.assetTag}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-950 dark:text-slate-100">{item.itemName}</span>
                        )}
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getItemLabel(item)}</p>
                        {item.notifications.length > 0 ? (
                          <div className="mt-3 space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 dark:border-[#4b5255] dark:bg-[#2f3437]/90">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Notifications</p>
                            {item.notifications.slice(0, 4).map((notification) => (
                              <div key={notification.id} className="grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-slate-800 dark:text-slate-100">{formatNotificationTypeLabel(notification.type)}</span>
                                  <NotificationStatusPill status={notification.status} />
                                </div>
                                <div className="truncate">{notification.recipient}</div>
                                <div className="text-slate-500 dark:text-slate-400">{formatDateTimeLabel(notification.sentAt ?? notification.createdAt)}</div>
                                {notification.error ? <div className="text-red-600 dark:text-red-300">{notification.error}</div> : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.quantity}</td>
                      <td className="px-3 py-3">
                        <Link className="font-medium text-[#b56613] underline-offset-4 transition hover:underline dark:text-[#ffd7ab]" href={buildUserHref(item.borrowerUser.id)}>
                          {item.borrowerUser.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTimeLabel(item.borrowedAt)}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTimeLabel(item.dueAt)}</td>
                      <td className="px-3 py-3"><StatusPill label={statusLabel} /></td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.issuedByUser.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {canManageBorrowedItems && !item.returnedAt ? (
                            <MarkReturnedButton action={markReturnedAction} item={item} />
                          ) : item.returnedAt ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              <RotateCcw className="h-3.5 w-3.5" />
                              Returned
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">View only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-[26px] border border-[#d7dde4] bg-white/80 px-4 py-3 dark:border-[#556068] dark:bg-[#2c3134] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-300">Showing <span className="font-medium text-slate-950 dark:text-slate-100">{visibleStart}-{visibleEnd}</span> of <span className="font-medium text-slate-950 dark:text-slate-100">{totalCount}</span>.</p>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link href={buildBorrowedItemsUrl({ q: query || null, status, page: Math.max(1, page - 1), pageSize })} aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-50" : undefined}>
            <Button type="button" variant="ghost">Previous</Button>
          </Link>
          <Link href={buildBorrowedItemsUrl({ q: query || null, status, page: Math.min(totalPages, page + 1), pageSize })} aria-disabled={page === totalPages} className={page === totalPages ? "pointer-events-none opacity-50" : undefined}>
            <Button type="button" variant="ghost">Next</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
