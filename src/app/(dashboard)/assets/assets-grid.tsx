"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy, Settings2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";
import { AssetListTransferDialog, type AssetListTransferState } from "@/modules/assets/asset-list-transfer-dialog";
import { ASSET_BULK_EDIT_HREF, buildAssetHref, buildAssetLabelHref } from "@/modules/assets/assets-routing";
import type { AssetSortOption } from "@/modules/assets/asset.service";
import { buildUserHref } from "@/modules/users/users-routing";

export type AssetGridRow = {
  id: string;
  assetTag: string;
  assetName: string;
  make: string | null;
  model: string | null;
  status: { label: string; color: string | null } | null;
  userId: string | null;
  user: string;
  serialNumber: string | null;
  comments: string | null;
  category: string;
  location: string;
  purchaseDate: string;
  warrantyExpiry: string;
  checkLabel: "Check out" | "Check in";
};

type ColumnId = "select" | "assetTag" | "assetModel" | "status" | "user" | "serialNumber" | "comments" | "category" | "location" | "purchaseDate" | "warrantyExpiry" | "actions";

type ColumnDefinition = {
  id: ColumnId;
  label: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth?: number;
  resizable: boolean;
  justify?: "start" | "center" | "end";
  cellPadding?: string;
  fixed?: boolean;
};

type ResizeState = {
  columnId: ColumnId;
  startX: number;
  startWidth: number;
};

type HeaderSortConfig = {
  href: string;
  label: string;
  direction: "asc" | "desc" | null;
};

type StickyPlacement = {
  className: string;
  style?: React.CSSProperties;
};

type AssetsGridProps = {
  rows: AssetGridRow[];
  returnTo: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
  activeSort: AssetSortOption;
  headerSorts: Partial<Record<"assetTag" | "assetModel", HeaderSortConfig>>;
  canBulkEditAssets: boolean;
  canDeleteAssets: boolean;
  canManageAssetTransfers: boolean;
  canPrintLabels: boolean;
  locations: Array<{ id: string; label: string }>;
  transferAction: (state: AssetListTransferState, formData: FormData) => Promise<AssetListTransferState>;
  users: Array<{ id: string; label: string }>;
};

const DEBUG_RESIZE = false;
const STORAGE_KEY = "assets-v2-grid-widths";
const VISIBILITY_STORAGE_KEY = "assets-v2-visible-columns";
const separatorClass = DEBUG_RESIZE ? "border-slate-500/90 dark:border-slate-400/80" : "border-slate-300/90 dark:border-gray-600/50";
const headerBaseClass = `relative flex min-w-0 items-center border-b border-r ${separatorClass} bg-[#eef2f6] py-3 text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-500 dark:bg-[#2f3539] dark:text-slate-400`;
const bodyBaseClass = `flex min-w-0 items-center border-b border-r ${separatorClass} bg-white py-3 dark:bg-[#353b3f]`;
const selectedBodyBaseClass = `flex min-w-0 items-center border-b border-r ${separatorClass} bg-[rgba(246,150,41,0.12)] py-3 dark:bg-[#4a4034]`;
const actionsRailBaseClass = "isolate border-l border-slate-300/90 bg-clip-padding dark:border-[#657078]";
const actionsHeaderRailClass = `${actionsRailBaseClass} bg-[#eef2f6] dark:bg-[#2f3539]`;
const actionsBodyRailClass = `${actionsRailBaseClass} bg-white dark:bg-[#353b3f]`;
const selectedActionsBodyRailClass = `${actionsRailBaseClass} bg-[#fef2e5] dark:bg-[#4a4034]`;
const sortableHeaderButtonClassName = "group inline-flex min-w-0 items-center gap-2 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:bg-white/80 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200";
const activeSortableHeaderButtonClassName = "bg-white text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.05)] dark:bg-white/8 dark:text-slate-100";
const columnMenuButtonClassName = "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-[#F69629]/50 hover:text-slate-900 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-300 dark:hover:border-[#F69629]/60 dark:hover:text-slate-100";
const columnMenuPanelClassName = "z-50 w-[260px] rounded-[22px] border border-[#d7dde4] bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur dark:border-[#556068] dark:bg-[#2c3134]/95";
const columnMenuItemClassName = "flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm text-slate-600 transition hover:bg-[#f6f8fb] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#353b3f] dark:hover:text-slate-100";

const PRIMARY_ACTION_STYLE = { width: "96px", height: "36px" } as const;
const SECONDARY_ACTION_STYLE = { width: "64px", height: "36px" } as const;
const DELETE_ACTION_STYLE = { width: "64px", height: "36px" } as const;
const ACTIONS_WIDTH = 272;
const DISABLED_PILL_STYLE = { borderColor: "#cbd5e1", backgroundColor: "#f1f5f9", color: "#64748b" } as const;
const VIEW_ACTIVE_STYLE = { borderColor: "#2f8f57", backgroundColor: "#3fb26d", color: "#ffffff" } as const;
const DELETE_ACTIVE_STYLE = { borderColor: "#c23b32", backgroundColor: "#dd4f45", color: "#ffffff" } as const;

const columns: ColumnDefinition[] = [
  { id: "select", label: DEBUG_RESIZE ? "Select (80)" : "Select", defaultWidth: 80, minWidth: 80, maxWidth: 80, resizable: false, justify: "center", cellPadding: "px-3", fixed: true },
  { id: "assetTag", label: DEBUG_RESIZE ? "Asset tag (140 fixed)" : "Asset Tag", defaultWidth: 140, minWidth: 140, maxWidth: 140, resizable: false, justify: "start", cellPadding: "px-3", fixed: true },
  { id: "assetModel", label: DEBUG_RESIZE ? "Make / Model (244)" : "Make / Model", defaultWidth: 244, minWidth: 120, maxWidth: 440, resizable: true, justify: "start", cellPadding: "px-3.5" },
  { id: "status", label: DEBUG_RESIZE ? "Status (124)" : "Status", defaultWidth: 124, minWidth: 96, maxWidth: 260, resizable: true, justify: "start", cellPadding: "px-3.5" },
  { id: "user", label: DEBUG_RESIZE ? "User (144)" : "User", defaultWidth: 144, minWidth: 96, maxWidth: 320, resizable: true, justify: "start", cellPadding: "px-3.5" },
  { id: "serialNumber", label: DEBUG_RESIZE ? "Serial Number (184)" : "Serial Number", defaultWidth: 184, minWidth: 144, maxWidth: 320, resizable: true, justify: "start", cellPadding: "px-3.5" },
  { id: "comments", label: "Comments", defaultWidth: 220, minWidth: 120, maxWidth: 440, resizable: true, justify: "start", cellPadding: "px-3.5" },
  { id: "category", label: "Category", defaultWidth: 168, minWidth: 96, maxWidth: 360, resizable: true, justify: "start", cellPadding: "px-3.5" },
  { id: "location", label: "Location", defaultWidth: 160, minWidth: 96, maxWidth: 360, resizable: true, justify: "start", cellPadding: "px-3.5" },
  { id: "purchaseDate", label: "Purchase Date", defaultWidth: 128, minWidth: 96, maxWidth: 220, resizable: true, justify: "start", cellPadding: "px-3.5" },
  { id: "warrantyExpiry", label: "Warranty Expiry", defaultWidth: 132, minWidth: 96, maxWidth: 220, resizable: true, justify: "start", cellPadding: "px-3.5" },
  { id: "actions", label: DEBUG_RESIZE ? "Actions (272 fixed)" : "Actions", defaultWidth: ACTIONS_WIDTH, minWidth: ACTIONS_WIDTH, maxWidth: ACTIONS_WIDTH, resizable: false, justify: "end", cellPadding: "px-3", fixed: true },
];

const fixedColumnIds = columns.filter((column) => column.fixed).map((column) => column.id);
const optionalColumns = columns.filter((column) => !column.fixed);
const defaultVisibleColumnIds: ColumnId[] = ["select", "assetTag", "assetModel", "status", "user", "serialNumber", "actions"];
const defaultWidths: Record<ColumnId, number> = Object.fromEntries(columns.map((column) => [column.id, column.defaultWidth])) as Record<ColumnId, number>;
let cachedColumnWidths: Record<ColumnId, number> | null = null;
let cachedContainerWidth = 0;
let cachedVisibleColumnIds: ColumnId[] | null = null;

function getJustifyClass(justify: ColumnDefinition["justify"]) {
  if (justify === "center") return "justify-center text-center";
  if (justify === "end") return "justify-end text-right";
  return "justify-start text-left";
}

function getColumn(columnId: ColumnId) {
  return columns.find((column) => column.id === columnId) ?? columns[0];
}

function clampColumnWidth(column: ColumnDefinition, width: number) {
  const maxWidth = column.maxWidth ?? 520;
  return Math.min(maxWidth, Math.max(column.minWidth, width));
}

function getStickyPlacement(columnId: ColumnId, renderedWidths: Record<ColumnId, number>): StickyPlacement | null {
  if (columnId === "select") {
    return {
      className: "sticky left-0 z-[4]",
      style: { left: 0 },
    };
  }

  if (columnId === "assetTag") {
    return {
      className: "sticky z-[4]",
      style: { left: `${renderedWidths.select}px` },
    };
  }

  if (columnId === "actions") {
    return {
      className: "sticky right-0 z-[40]",
      style: { right: 0 },
    };
  }

  return null;
}
function buildDeleteMessage(row: AssetGridRow) {
  return `Delete asset ${row.assetTag} - ${row.model ?? row.assetName}?`;
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through for browsers or origins where clipboard permission is blocked.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function SerialNumberCell({ serialNumber }: { serialNumber: string | null }) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedSerialNumber = serialNumber?.trim() ?? "";

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (!normalizedSerialNumber) {
      return;
    }

    const wasCopied = await copyTextToClipboard(normalizedSerialNumber);

    if (wasCopied) {
      setCopied(true);

      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      resetTimeoutRef.current = setTimeout(() => setCopied(false), 1800);
    } else {
      setCopied(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        aria-label={normalizedSerialNumber ? "Copy serial number" : "No serial number to copy"}
        className={`h-7 w-7 shrink-0 p-0 ${copied ? "text-emerald-600 dark:text-emerald-400" : ""}`}
        disabled={!normalizedSerialNumber}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleCopy();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        title={normalizedSerialNumber ? "Copy serial number" : "No serial number to copy"}
        type="button"
        variant="ghost"
      >
        {copied ? (
          <Check aria-hidden="true" className="h-4 w-4 animate-[pulse_0.35s_ease-out_1]" />
        ) : (
          <Copy aria-hidden="true" className="h-4 w-4" />
        )}
        <span className="sr-only" aria-live="polite">{copied ? "Serial number copied" : "Copy serial number"}</span>
      </Button>
      <span
        className={`min-w-0 flex-1 truncate text-sm ${normalizedSerialNumber ? "font-semibold text-[#b56613] dark:text-[#ffd7ab]" : "text-slate-400 dark:text-slate-500"}`}
        title={normalizedSerialNumber || "Not set"}
      >
        {normalizedSerialNumber || "Not set"}
      </span>
    </div>
  );
}

function normalizeVisibleColumnIds(value: unknown): ColumnId[] {
  const requested = Array.isArray(value) ? value.filter((entry): entry is ColumnId => columns.some((column) => column.id === entry)) : [];
  const visible = new Set<ColumnId>(defaultVisibleColumnIds);

  for (const id of requested) {
    if (fixedColumnIds.includes(id)) continue;
    visible.add(id);
  }

  for (const fixedId of fixedColumnIds) {
    visible.add(fixedId);
  }

  return columns.filter((column) => visible.has(column.id)).map((column) => column.id);
}

function SortIndicator({ direction }: { direction: "asc" | "desc" | null }) {
  if (direction === "asc") {
    return <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.8} />;
  }

  if (direction === "desc") {
    return <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.8} />;
  }

  return <ArrowUpDown className="h-3.5 w-3.5 opacity-70 transition group-hover:opacity-100" strokeWidth={1.8} />;
}

function ActionLink({ href, label, isSelected, style, sizeStyle }: { href: string; label: string; isSelected: boolean; style: typeof VIEW_ACTIVE_STYLE; sizeStyle: typeof SECONDARY_ACTION_STYLE }) {
  const className = isSelected
    ? "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-white"
    : "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-slate-500 dark:text-slate-200";

  if (!isSelected) {
    return <span aria-disabled="true" className={className} style={{ ...sizeStyle, ...DISABLED_PILL_STYLE }}>{label}</span>;
  }

  return <Link className={className} href={href} style={{ ...sizeStyle, ...style }}>{label}</Link>;
}

function DeleteButton({ row, isAllowed, isSelected, deleteAction, returnTo }: { row: AssetGridRow; isAllowed: boolean; isSelected: boolean; deleteAction: (formData: FormData) => void | Promise<void>; returnTo: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const className = isSelected
    ? "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-white"
    : "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-slate-500 dark:text-slate-200";

  if (!isSelected || !isAllowed) {
    return <span aria-disabled="true" className={className} style={{ ...DELETE_ACTION_STYLE, ...DISABLED_PILL_STYLE }}>Delete</span>;
  }

  return (
    <form action={deleteAction} onClick={(event) => event.stopPropagation()} ref={formRef}>
      <input name="assetId" type="hidden" value={row.id} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <button
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (window.confirm(buildDeleteMessage(row))) {
            formRef.current?.requestSubmit();
          }
        }}
        style={{ ...DELETE_ACTION_STYLE, ...DELETE_ACTIVE_STYLE }}
        type="submit"
      >
        Delete
      </button>
    </form>
  );
}

export function AssetsGrid({
  rows,
  returnTo,
  deleteAction,
  activeSort,
  headerSorts,
  canBulkEditAssets,
  canDeleteAssets,
  canManageAssetTransfers,
  canPrintLabels,
  locations,
  transferAction,
  users,
}: AssetsGridProps) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(rows[0]?.id ?? null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnId, number>>(() => {
    if (typeof window !== "undefined" && cachedColumnWidths) {
      return cachedColumnWidths;
    }

    return defaultWidths;
  });
  const [visibleColumnIds, setVisibleColumnIds] = useState<ColumnId[]>(() => {
    if (typeof window !== "undefined" && cachedVisibleColumnIds) {
      return cachedVisibleColumnIds;
    }

    return defaultVisibleColumnIds;
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [columnMenuPosition, setColumnMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [resizingColumnId, setResizingColumnId] = useState<ColumnId | null>(null);
  const [guideX, setGuideX] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => (typeof window !== "undefined" ? cachedContainerWidth : 0));
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    try {
      const storedWidths = window.localStorage.getItem(STORAGE_KEY);
      if (storedWidths) {
        const parsed = JSON.parse(storedWidths) as Partial<Record<ColumnId, number>>;
        const next = { ...defaultWidths };

        for (const column of columns) {
          if (!column.resizable) continue;
          const value = parsed[column.id];
          if (typeof value === "number" && Number.isFinite(value)) {
            next[column.id] = clampColumnWidth(column, value);
          }
        }

        cachedColumnWidths = next;
        setColumnWidths(next);
      }

      const storedVisibility = window.localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (storedVisibility) {
        const parsed = JSON.parse(storedVisibility);
        const nextVisibleColumnIds = normalizeVisibleColumnIds(parsed);
        cachedVisibleColumnIds = nextVisibleColumnIds;
        setVisibleColumnIds(nextVisibleColumnIds);
      }
    } catch {
      // Ignore invalid stored values.
    } finally {
      setIsHydrated(true);
    }
  }, []);
  useEffect(() => {
    setSelectedRowId((current) => {
      if (!rows.length) {
        return null;
      }

      if (current && rows.some((row) => row.id === current)) {
        return current;
      }

      return rows[0]?.id ?? null;
    });
  }, [rows]);

  useEffect(() => {
    setSelectedAssetIds((current) => current.filter((assetId) => rows.some((row) => row.id === assetId)));
  }, [rows]);

  useEffect(() => {
    cachedColumnWidths = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    cachedVisibleColumnIds = visibleColumnIds;
  }, [visibleColumnIds]);

  useEffect(() => {
    cachedContainerWidth = containerWidth;
  }, [containerWidth]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persistable: Partial<Record<ColumnId, number>> = { ...columnWidths };
    for (const fixedId of fixedColumnIds) {
      delete persistable[fixedId];
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [columnWidths, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumnIds));
  }, [visibleColumnIds, isHydrated]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) {
        setIsColumnsMenuOpen(false);
      }
    }

    if (isColumnsMenuOpen) {
      window.addEventListener("pointerdown", handlePointerDown);
      return () => window.removeEventListener("pointerdown", handlePointerDown);
    }
  }, [isColumnsMenuOpen]);

  useEffect(() => {
    if (!isColumnsMenuOpen) {
      return;
    }

    function updateColumnMenuPosition() {
      const rect = menuButtonRef.current?.getBoundingClientRect();
      if (!rect) return;

      setColumnMenuPosition({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }

    updateColumnMenuPosition();
    window.addEventListener("resize", updateColumnMenuPosition);
    window.addEventListener("scroll", updateColumnMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateColumnMenuPosition);
      window.removeEventListener("scroll", updateColumnMenuPosition, true);
    };
  }, [isColumnsMenuOpen]);

  const allVisibleAssetIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allVisibleSelected = allVisibleAssetIds.length > 0 && allVisibleAssetIds.every((assetId) => selectedAssetIds.includes(assetId));
  const partiallySelected = selectedAssetIds.length > 0 && !allVisibleSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  useLayoutEffect(() => {
    const updateWidth = () => {
      setContainerWidth(wrapperRef.current?.clientWidth ?? 0);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const updateScrollState = () => {
      const maxScrollLeft = wrapper.scrollWidth - wrapper.clientWidth;
      setScrollState({
        canScrollLeft: wrapper.scrollLeft > 8,
        canScrollRight: maxScrollLeft - wrapper.scrollLeft > 8,
      });
    };

    updateScrollState();
    wrapper.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      wrapper.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [rows.length, visibleColumnIds, containerWidth, columnWidths]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const state = resizeStateRef.current;
      if (!state) return;

      const column = getColumn(state.columnId);
      const delta = event.clientX - state.startX;
      const nextWidth = clampColumnWidth(column, state.startWidth + delta);

      setColumnWidths((current) => ({
        ...current,
        [state.columnId]: nextWidth,
      }));

      const rect = contentRef.current?.getBoundingClientRect();
      if (rect) {
        setGuideX(event.clientX - rect.left);
      }
    }

    function handlePointerUp() {
      resizeStateRef.current = null;
      setResizingColumnId(null);
      setGuideX(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  function startResize(columnId: ColumnId, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      columnId,
      startX: event.clientX,
      startWidth: columnWidths[columnId],
    };
    setResizingColumnId(columnId);

    const rect = contentRef.current?.getBoundingClientRect();
    if (rect) {
      setGuideX(event.clientX - rect.left);
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }
  function toggleColumnVisibility(columnId: ColumnId) {
    if (fixedColumnIds.includes(columnId)) {
      return;
    }

    setVisibleColumnIds((current) => {
      const visible = new Set(current);
      if (visible.has(columnId)) {
        visible.delete(columnId);
      } else {
        visible.add(columnId);
      }

      for (const fixedId of fixedColumnIds) {
        visible.add(fixedId);
      }

      return columns.filter((column) => visible.has(column.id)).map((column) => column.id);
    });
  }

  function toggleAssetSelection(assetId: string) {
    setSelectedAssetIds((current) => (
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    ));
  }

  function toggleSelectAllVisible() {
    setSelectedAssetIds((current) => {
      if (allVisibleSelected) {
        return current.filter((assetId) => !allVisibleAssetIds.includes(assetId));
      }

      const next = new Set(current);
      for (const assetId of allVisibleAssetIds) {
        next.add(assetId);
      }

      return Array.from(next);
    });
  }

  const visibleColumns = useMemo(() => columns.filter((column) => visibleColumnIds.includes(column.id)), [visibleColumnIds]);

  const renderedWidths = useMemo(() => {
    const next = { ...columnWidths };
    const baseWidth = visibleColumns.reduce((sum, column) => sum + next[column.id], 0);
    const extraWidth = Math.max(0, containerWidth - baseWidth);

    if (extraWidth > 0) {
      const stretchColumn = [...visibleColumns].reverse().find((column) => column.id !== "actions" && column.id !== "assetTag" && column.id !== "select");
      if (stretchColumn) {
        next[stretchColumn.id] += extraWidth;
      }
    }

    return next;
  }, [columnWidths, containerWidth, visibleColumns]);

  const gridTemplateColumns = useMemo(
    () => visibleColumns.map((column) => `${renderedWidths[column.id]}px`).join(" "),
    [renderedWidths, visibleColumns],
  );

  const isGridVisible = isHydrated && (cachedContainerWidth > 0 || containerWidth > 0);

  const tableWidth = useMemo(
    () => visibleColumns.reduce((sum, column) => sum + renderedWidths[column.id], 0),
    [renderedWidths, visibleColumns],
  );
  const hasHorizontalOverflow = containerWidth > 0 && tableWidth > containerWidth;
  const scrollReserveWidth = hasHorizontalOverflow && visibleColumnIds.includes("actions") ? ACTIONS_WIDTH : 0;

  return (
    <div
      className="overflow-hidden rounded-[28px] border border-[#d7dde4] bg-[#f6f8fb] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[#556068] dark:bg-[#2c3134]"
      onClick={() => setSelectedRowId(null)}
    >
      <div className="flex items-center justify-between border-b border-[#d7dde4] px-4 py-3 dark:border-[#556068]">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Asset table</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose optional columns, keep row-level actions separate, and use the checkbox column for bulk selection. Select, Asset Tag, and Actions remain fixed.</p>
        </div>
        <div className="flex items-center gap-3">
          {canBulkEditAssets ? (
            <form action={ASSET_BULK_EDIT_HREF} method="get" onClick={(event) => event.stopPropagation()}>
              <input name="returnTo" type="hidden" value={returnTo} />
              {selectedAssetIds.map((assetId) => (
                <input key={assetId} name="assetIds" type="hidden" value={assetId} />
              ))}
              <Button disabled={selectedAssetIds.length === 0} type="submit" variant="secondary">
                {selectedAssetIds.length === 0 ? "Bulk edit selected" : `Bulk edit ${selectedAssetIds.length} selected`}
              </Button>
            </form>
          ) : null}
          <div className="relative">
            <button
              className={columnMenuButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                setIsColumnsMenuOpen((current) => !current);
              }}
              ref={menuButtonRef}
              type="button"
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.8} />
              <span>Columns</span>
            </button>
            {isColumnsMenuOpen && columnMenuPosition ? createPortal(
              <div
                className={columnMenuPanelClassName}
                onClick={(event) => event.stopPropagation()}
                ref={menuRef}
                style={{ position: "fixed", top: `${columnMenuPosition.top}px`, right: `${columnMenuPosition.right}px` }}
              >
                <div className="mb-2 px-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Visible columns</p>
                </div>
                <div className="space-y-1">
                  {optionalColumns.map((column) => {
                    const isChecked = visibleColumnIds.includes(column.id);
                    return (
                      <label key={column.id} className={columnMenuItemClassName}>
                        <span>{column.label}</span>
                        <input checked={isChecked} className="ui-check" onChange={() => toggleColumnVisibility(column.id)} type="checkbox" />
                      </label>
                    );
                  })}
                </div>
              </div>,
              document.body,
            ) : null}
          </div>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No assets matched the current filters.</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Adjust the search or filters above to populate the asset grid.</p>
        </div>
      ) : (
        <div className="relative">
          {scrollState.canScrollLeft ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-[#f6f8fb] via-[#f6f8fb]/92 to-transparent dark:from-[#2c3134] dark:via-[#2c3134]/92" />
          ) : null}
          {scrollState.canScrollRight ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-[#f6f8fb] via-[#f6f8fb]/92 to-transparent dark:from-[#2c3134] dark:via-[#2c3134]/92" />
          ) : null}
          <div className="min-h-[188px] overflow-x-auto overscroll-x-contain" ref={wrapperRef} style={{ visibility: isGridVisible ? "visible" : "hidden", scrollbarWidth: "thin" }}>
            <div
              ref={contentRef}
              style={{
                minWidth: `${tableWidth}px`,
                paddingRight: scrollReserveWidth > 0 ? `${scrollReserveWidth}px` : undefined,
                width: containerWidth > 0 ? "100%" : `${tableWidth}px`,
              }}
            >
              <div className="relative">
                {guideX !== null ? (
                  <div className="pointer-events-none absolute inset-y-0 z-30 w-px bg-[#F69629] shadow-[0_0_0_1px_rgba(246,150,41,0.28)]" style={{ left: `${guideX}px` }} />
                ) : null}

                <div className="grid" style={{ gridTemplateColumns }}>
                  {visibleColumns.map((column, index) => {
                    const isLast = index === visibleColumns.length - 1;
                    const canResizeColumn = column.resizable && !column.fixed;
                    const stickyPlacement = getStickyPlacement(column.id, renderedWidths);
                    const headerClassName = [
                      headerBaseClass,
                      column.cellPadding ?? "px-4",
                      column.id === "actions" ? "justify-start text-left" : getJustifyClass(column.justify),
                      stickyPlacement?.className ?? "",
                      column.id === "actions" ? actionsHeaderRailClass : "",
                      isLast ? "border-r-0" : "",
                    ].join(" ");
                    const headerSort = (column.id === "assetTag" || column.id === "assetModel") ? headerSorts[column.id] : null;
                    const isActiveSort = column.id === "assetTag"
                      ? activeSort === "tag-asc" || activeSort === "tag-desc"
                      : column.id === "assetModel"
                        ? activeSort === "model-asc" || activeSort === "model-desc"
                        : false;

                    return (
                      <div key={column.id} className={headerClassName} style={stickyPlacement?.style}>
                        {column.id === "select" ? (
                          <input
                            checked={allVisibleSelected}
                            className="ui-check"
                            onChange={() => toggleSelectAllVisible()}
                            onClick={(event) => event.stopPropagation()}
                            ref={selectAllCheckboxRef}
                            type="checkbox"
                          />
                        ) : headerSort ? (
                          <Link
                            aria-label={headerSort.label}
                            className={`${sortableHeaderButtonClassName} ${isActiveSort ? activeSortableHeaderButtonClassName : ""}`}
                            href={headerSort.href}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <span className="block min-w-0 truncate whitespace-nowrap">{column.label}</span>
                            <SortIndicator direction={headerSort.direction} />
                          </Link>
                        ) : column.id === "actions" ? (
                          <div className="flex h-full w-full flex-nowrap items-center justify-start gap-2 overflow-hidden whitespace-nowrap">
                            <span className="block min-w-0 truncate whitespace-nowrap">Actions</span>
                          </div>
                        ) : (
                          <span className="block min-w-0 truncate whitespace-nowrap">{column.label}</span>
                        )}
                        {canResizeColumn ? (
                          <button
                            aria-label={`Resize ${column.label} column`}
                            className={`absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize transition ${DEBUG_RESIZE ? "bg-[#F69629]/35" : "bg-slate-500/22"} hover:bg-[#F69629]/45 ${resizingColumnId === column.id ? "bg-[#F69629]/65" : ""}`}
                            onPointerDown={(event) => startResize(column.id, event)}
                            type="button"
                          >
                            <span className={`absolute inset-y-0 right-0 w-px ${DEBUG_RESIZE ? "bg-[#F69629]" : "bg-slate-500/80"}`} />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {rows.map((row) => {
                  const isSelected = row.id === selectedRowId;
                  const rowClass = isSelected ? selectedBodyBaseClass : bodyBaseClass;
                  const hoverClass = isSelected ? "hover:bg-[rgba(246,150,41,0.16)] dark:hover:bg-[#54483a]" : "hover:bg-[#fdf1e4] dark:hover:bg-[#3d4448]";
                  const viewHref = buildAssetHref(row.id, { returnTo });
                  const labelHref = buildAssetLabelHref(row.id, { returnTo });

                  return (
                    <div
                      key={row.id}
                      className={`grid w-full cursor-pointer transition-colors ${hoverClass}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedRowId((current) => (current === row.id ? null : row.id));
                      }}
                      style={{ gridTemplateColumns }}
                    >
                      {visibleColumns.map((column, index) => {
                        const isLast = index === visibleColumns.length - 1;
                        const stickyPlacement = getStickyPlacement(column.id, renderedWidths);
                        const cellClass = [
                          rowClass,
                          column.cellPadding ?? "px-4",
                          getJustifyClass(column.justify),
                          stickyPlacement?.className ?? "",
                          column.id === "actions" ? (isSelected ? selectedActionsBodyRailClass : actionsBodyRailClass) : "",
                          isLast ? "border-r-0" : "",
                        ].join(" ");

                        if (column.id === "select") {
                          return (
                            <div key={column.id} className={cellClass} style={stickyPlacement?.style}>
                              <input
                                checked={selectedAssetIds.includes(row.id)}
                                className="ui-check"
                                onChange={() => toggleAssetSelection(row.id)}
                                onClick={(event) => event.stopPropagation()}
                                type="checkbox"
                              />
                            </div>
                          );
                        }

                        if (column.id === "assetTag") {
                          return (
                            <div key={column.id} className={cellClass} style={stickyPlacement?.style}>
                              {canPrintLabels ? (
                                <Link
                                  className="block truncate text-sm font-semibold text-[#b56613] decoration-[#d9892c] underline-offset-4 transition hover:underline focus-visible:underline focus-visible:outline-none dark:text-[#ffd7ab] dark:decoration-[#f0a853]"
                                  href={labelHref}
                                  onClick={(event) => event.stopPropagation()}
                                  title={`Print label for ${row.assetTag}`}
                                >
                                  {row.assetTag}
                                </Link>
                              ) : (
                                <span className="block truncate text-sm font-semibold text-[#b56613] dark:text-[#ffd7ab]">{row.assetTag}</span>
                              )}
                            </div>
                          );
                        }

                        if (column.id === "assetModel") {
                          return (
                            <div key={column.id} className={cellClass} style={stickyPlacement?.style}>
                              <div className="min-w-0">
                                {row.make?.trim() ? <span className="block min-w-0 truncate whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400" title={row.make.trim()}>{row.make.trim()}</span> : null}
                                <span className="block min-w-0 truncate whitespace-nowrap text-sm font-medium text-slate-950 dark:text-slate-100" title={row.model?.trim() || "No model"}>{row.model?.trim() || "No model"}</span>
                              </div>
                            </div>
                          );
                        }

                        if (column.id === "status") {
                          return <div key={column.id} className={cellClass} style={stickyPlacement?.style}>{row.status ? <AssetStatusPill color={row.status.color} label={row.status.label} /> : <span className="text-sm text-slate-500 dark:text-slate-400">No status</span>}</div>;
                        }

                        if (column.id === "user") {
                          return (
                            <div key={column.id} className={cellClass} style={stickyPlacement?.style}>
                              {row.userId ? (
                                <Link
                                  className="block truncate text-sm font-medium text-[#b56613] underline-offset-4 transition hover:underline dark:text-[#ffd7ab]"
                                  href={buildUserHref(row.userId)}
                                  onClick={(event) => event.stopPropagation()}
                                  title={row.user}
                                >
                                  {row.user}
                                </Link>
                              ) : (
                                <span className="block truncate text-sm text-slate-600 dark:text-slate-300" title={row.user}>{row.user}</span>
                              )}
                            </div>
                          );
                        }

                        if (column.id === "serialNumber") {
                          return <div key={column.id} className={cellClass} style={stickyPlacement?.style}><SerialNumberCell serialNumber={row.serialNumber} /></div>;
                        }

                        if (column.id === "comments") {
                          const comments = row.comments?.trim() ?? "";
                          return <div key={column.id} className={cellClass} style={stickyPlacement?.style}><span className={`block truncate text-sm ${comments ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`} title={comments || "No comments"}>{comments || "No comments"}</span></div>;
                        }

                        if (column.id === "category") {
                          return <div key={column.id} className={cellClass} style={stickyPlacement?.style}><span className="block truncate text-sm text-slate-600 dark:text-slate-300" title={row.category}>{row.category}</span></div>;
                        }

                        if (column.id === "location") {
                          return <div key={column.id} className={cellClass} style={stickyPlacement?.style}><span className="block truncate text-sm text-slate-600 dark:text-slate-300" title={row.location}>{row.location}</span></div>;
                        }

                        if (column.id === "purchaseDate") {
                          return <div key={column.id} className={cellClass} style={stickyPlacement?.style}><span className="block truncate text-sm text-slate-600 dark:text-slate-300">{row.purchaseDate}</span></div>;
                        }

                        if (column.id === "warrantyExpiry") {
                          return <div key={column.id} className={cellClass} style={stickyPlacement?.style}><span className="block truncate text-sm text-slate-600 dark:text-slate-300">{row.warrantyExpiry}</span></div>;
                        }

                        return (
                          <div key={column.id} className={cellClass} onClick={(event) => event.stopPropagation()} style={stickyPlacement?.style}>
                            <div className="flex h-full w-full flex-nowrap items-center justify-end gap-2 overflow-hidden">
                              <div className="flex justify-end" style={{ width: SECONDARY_ACTION_STYLE.width }}>
                                <ActionLink href={viewHref} isSelected={isSelected} label="View" sizeStyle={SECONDARY_ACTION_STYLE} style={VIEW_ACTIVE_STYLE} />
                              </div>
                              <div className="flex justify-end" style={{ width: PRIMARY_ACTION_STYLE.width }}>
                                {canManageAssetTransfers ? (
                                  <AssetListTransferDialog
                                    action={transferAction}
                                    asset={row}
                                    isActive={isSelected}
                                    locations={locations}
                                    returnTo={returnTo}
                                    users={users}
                                  />
                                ) : null}
                              </div>
                              <div className="flex justify-end" style={{ width: DELETE_ACTION_STYLE.width }}>
                                <DeleteButton deleteAction={deleteAction} isAllowed={canDeleteAssets} isSelected={isSelected} returnTo={returnTo} row={row} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

