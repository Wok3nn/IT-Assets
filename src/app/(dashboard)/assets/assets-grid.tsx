"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { AssetStatusPill } from "@/modules/assets/asset-status-pill";
import { buildAssetHref } from "@/modules/assets/assets-routing";

export type AssetGridRow = {
  id: string;
  assetTag: string;
  assetName: string;
  status: { label: string; color: string | null } | null;
  user: string;
  serialNumber: string;
  checkLabel: "Check out" | "Check in";
};

type ColumnId = "select" | "assetTag" | "assetName" | "status" | "user" | "serialNumber" | "actions";

type ColumnDefinition = {
  id: ColumnId;
  label: string;
  defaultWidth: number;
  minWidth: number;
  resizable: boolean;
  justify?: "start" | "center" | "end";
  cellPadding?: string;
};

type ResizeState = {
  leftId: ColumnId;
  rightId: ColumnId;
  startX: number;
  leftStartWidth: number;
  rightStartWidth: number;
};

type AssetsGridProps = {
  rows: AssetGridRow[];
  returnTo: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

const DEBUG_RESIZE = false;
const STORAGE_KEY = "assets-v2-grid-widths";
const separatorClass = DEBUG_RESIZE ? "border-slate-500/90 dark:border-slate-400/80" : "border-slate-300/90 dark:border-gray-600/50";
const headerBaseClass = `relative flex min-w-0 items-center border-b border-r ${separatorClass} bg-[#eef2f6] py-3 text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-500 dark:bg-[#2f3539] dark:text-slate-400`;
const bodyBaseClass = `flex min-w-0 items-center border-b border-r ${separatorClass} bg-white py-3 dark:bg-[#353b3f]`;
const selectedBodyBaseClass = `flex min-w-0 items-center border-b border-r ${separatorClass} bg-[rgba(246,150,41,0.12)] py-3 dark:bg-[#4a4034]`;

const PRIMARY_ACTION_STYLE = { width: "96px", height: "36px" } as const;
const SECONDARY_ACTION_STYLE = { width: "68px", height: "36px" } as const;
const DELETE_ACTION_STYLE = { width: "68px", height: "36px" } as const;
const DISABLED_PILL_STYLE = { borderColor: "#cbd5e1", backgroundColor: "#f1f5f9", color: "#64748b" } as const;
const VIEW_ACTIVE_STYLE = { borderColor: "#2f8f57", backgroundColor: "#3fb26d", color: "#ffffff" } as const;
const CHECK_ACTIVE_STYLE = { borderColor: "#d9892c", backgroundColor: "#F69629", color: "#ffffff" } as const;
const DELETE_ACTIVE_STYLE = { borderColor: "#c23b32", backgroundColor: "#dd4f45", color: "#ffffff" } as const;

const columns: ColumnDefinition[] = [
  { id: "select", label: DEBUG_RESIZE ? "Select (80)" : "Select", defaultWidth: 80, minWidth: 80, resizable: true, justify: "center", cellPadding: "px-3" },
  { id: "assetTag", label: DEBUG_RESIZE ? "Asset tag (108)" : "Asset tag", defaultWidth: 108, minWidth: 96, resizable: true, justify: "start", cellPadding: "px-4" },
  { id: "assetName", label: DEBUG_RESIZE ? "Asset name (360)" : "Asset name", defaultWidth: 360, minWidth: 48, resizable: true, justify: "start", cellPadding: "px-4" },
  { id: "status", label: DEBUG_RESIZE ? "Status (140)" : "Status", defaultWidth: 140, minWidth: 110, resizable: true, justify: "start", cellPadding: "px-4" },
  { id: "user", label: DEBUG_RESIZE ? "User (170)" : "User", defaultWidth: 170, minWidth: 120, resizable: true, justify: "start", cellPadding: "px-4" },
  { id: "serialNumber", label: DEBUG_RESIZE ? "Serial Number (172)" : "Serial Number", defaultWidth: 172, minWidth: 96, resizable: true, justify: "start", cellPadding: "px-4" },
  { id: "actions", label: DEBUG_RESIZE ? "Actions (284 fixed)" : "Actions", defaultWidth: 284, minWidth: 284, resizable: false, justify: "end", cellPadding: "px-3" },
];

const defaultWidths: Record<ColumnId, number> = Object.fromEntries(columns.map((column) => [column.id, column.defaultWidth])) as Record<ColumnId, number>;
let cachedColumnWidths: Record<ColumnId, number> | null = null;
let cachedContainerWidth = 0;


function getJustifyClass(justify: ColumnDefinition["justify"]) {
  if (justify === "center") return "justify-center text-center";
  if (justify === "end") return "justify-end text-right";
  return "justify-start text-left";
}

function getColumn(columnId: ColumnId) {
  return columns.find((column) => column.id === columnId) ?? columns[0];
}

function buildDeleteMessage(row: AssetGridRow) {
  return `Delete asset ${row.assetTag} - ${row.assetName}?`;
}

function ActionLink({ href, label, isSelected, style, sizeStyle }: { href: string; label: string; isSelected: boolean; style: typeof VIEW_ACTIVE_STYLE | typeof CHECK_ACTIVE_STYLE; sizeStyle: typeof PRIMARY_ACTION_STYLE | typeof SECONDARY_ACTION_STYLE }) {
  const className = isSelected
    ? "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-white"
    : "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-slate-500 dark:text-slate-200";

  if (!isSelected) {
    return <span aria-disabled="true" className={className} style={{ ...sizeStyle, ...DISABLED_PILL_STYLE }}>{label}</span>;
  }

  return <Link className={className} href={href} style={{ ...sizeStyle, ...style }}>{label}</Link>;
}

function DeleteButton({ row, isSelected, deleteAction, returnTo }: { row: AssetGridRow; isSelected: boolean; deleteAction: (formData: FormData) => void | Promise<void>; returnTo: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const className = isSelected
    ? "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-white"
    : "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-none text-slate-500 dark:text-slate-200";

  if (!isSelected) {
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

export function AssetsGrid({ rows, returnTo, deleteAction }: AssetsGridProps) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(rows[0]?.id ?? null);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnId, number>>(() => {
    if (typeof window !== "undefined" && cachedColumnWidths) {
      return cachedColumnWidths;
    }

    return defaultWidths;
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [resizingPair, setResizingPair] = useState<{ leftId: ColumnId; rightId: ColumnId } | null>(null);
  const [guideX, setGuideX] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => (typeof window !== "undefined" ? cachedContainerWidth : 0));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Record<ColumnId, number>>;
        const next = { ...defaultWidths };

        for (const column of columns) {
          if (!column.resizable) continue;
          const value = parsed[column.id];
          if (typeof value === "number" && Number.isFinite(value)) {
            next[column.id] = Math.max(column.minWidth, value);
          }
        }

        cachedColumnWidths = next;
        setColumnWidths(next);
      }
    } catch {
      // Ignore invalid stored widths.
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
    cachedColumnWidths = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    cachedContainerWidth = containerWidth;
  }, [containerWidth]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persistable = { ...columnWidths };
    delete persistable.actions;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [columnWidths, isHydrated]);

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
    function handlePointerMove(event: PointerEvent) {
      const state = resizeStateRef.current;
      if (!state) return;

      const leftColumn = getColumn(state.leftId);
      const rightColumn = getColumn(state.rightId);
      const delta = event.clientX - state.startX;

      let nextLeft = state.leftStartWidth + delta;
      let nextRight = state.rightStartWidth - delta;

      if (nextLeft < leftColumn.minWidth) {
        const correction = leftColumn.minWidth - nextLeft;
        nextLeft = leftColumn.minWidth;
        nextRight -= correction;
      }

      if (nextRight < rightColumn.minWidth) {
        const correction = rightColumn.minWidth - nextRight;
        nextRight = rightColumn.minWidth;
        nextLeft -= correction;
      }

      nextLeft = Math.max(leftColumn.minWidth, nextLeft);
      nextRight = Math.max(rightColumn.minWidth, nextRight);

      setColumnWidths((current) => ({
        ...current,
        [state.leftId]: nextLeft,
        [state.rightId]: nextRight,
      }));

      const rect = contentRef.current?.getBoundingClientRect();
      if (rect) {
        setGuideX(event.clientX - rect.left);
      }
    }

    function handlePointerUp() {
      resizeStateRef.current = null;
      setResizingPair(null);
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

  function startResize(leftId: ColumnId, rightId: ColumnId, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      leftId,
      rightId,
      startX: event.clientX,
      leftStartWidth: columnWidths[leftId],
      rightStartWidth: columnWidths[rightId],
    };
    setResizingPair({ leftId, rightId });

    const rect = contentRef.current?.getBoundingClientRect();
    if (rect) {
      setGuideX(event.clientX - rect.left);
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  const renderedWidths = useMemo(() => {
    const next = { ...columnWidths };
    const baseWidth = columns.reduce((sum, column) => sum + next[column.id], 0);
    const extraWidth = Math.max(0, containerWidth - baseWidth);

    if (extraWidth > 0) {
      next.serialNumber += extraWidth;
    }

    return next;
  }, [columnWidths, containerWidth]);

  const gridTemplateColumns = useMemo(
    () => columns.map((column) => `${renderedWidths[column.id]}px`).join(" "),
    [renderedWidths],
  );

  const isGridVisible = isHydrated && (cachedContainerWidth > 0 || containerWidth > 0);

  const tableWidth = useMemo(
    () => columns.reduce((sum, column) => sum + renderedWidths[column.id], 0),
    [renderedWidths],
  );

  return (
    <div
      className="overflow-hidden rounded-[28px] border border-[#d7dde4] bg-[#f6f8fb] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[#556068] dark:bg-[#2c3134]"
      onClick={() => setSelectedRowId(null)}
    >
      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No assets matched the current filters.</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Adjust the search or filters above to populate the asset grid.</p>
        </div>
      ) : (
        <div
          className="min-h-[188px] overflow-x-auto"
          ref={wrapperRef}
          style={{ visibility: isGridVisible ? "visible" : "hidden" }}
        >
          <div ref={contentRef} style={{ minWidth: `${tableWidth}px`, width: containerWidth > 0 ? "100%" : `${tableWidth}px` }}>
            <div className="relative">
              {guideX !== null ? (
                <div
                  className="pointer-events-none absolute inset-y-0 z-30 w-px bg-[#F69629] shadow-[0_0_0_1px_rgba(246,150,41,0.28)]"
                  style={{ left: `${guideX}px` }}
                />
              ) : null}

              <div className="grid" style={{ gridTemplateColumns }}>
                {columns.map((column, index) => {
                  const isLast = index === columns.length - 1;
                  const nextColumn = columns[index + 1] ?? null;
                  const canResizeAgainstNext = column.resizable && nextColumn && nextColumn.id !== "actions";
                  const headerClassName = [
                    headerBaseClass,
                    column.cellPadding ?? "px-4",
                    column.id === "actions" ? "justify-start text-left" : getJustifyClass(column.justify),
                    isLast ? "border-r-0" : "",
                  ].join(" ");

                  return (
                    <div key={column.id} className={headerClassName}>
                      <span className="block min-w-0 truncate whitespace-nowrap">{column.label}</span>
                      {canResizeAgainstNext ? (
                        <button
                          aria-label={`Resize ${column.label} column`}
                          className={`absolute right-0 top-0 z-20 h-full w-3 translate-x-1/2 cursor-col-resize transition ${DEBUG_RESIZE ? "bg-[#F69629]/35" : "bg-slate-500/22"} hover:bg-[#F69629]/45 ${resizingPair?.leftId === column.id ? "bg-[#F69629]/65" : ""}`}
                          onPointerDown={(event) => startResize(column.id, nextColumn.id, event)}
                          type="button"
                        >
                          <span className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${DEBUG_RESIZE ? "bg-[#F69629]" : "bg-slate-500/80"}`} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {rows.map((row) => {
                const isSelected = row.id === selectedRowId;
                const rowClass = isSelected ? selectedBodyBaseClass : bodyBaseClass;
                const hoverClass = isSelected
                  ? "hover:bg-[rgba(246,150,41,0.16)] dark:hover:bg-[#54483a]"
                  : "hover:bg-[#fdf1e4] dark:hover:bg-[#3d4448]";
                const checkHref = buildAssetHref(row.id, {
                  transfer: row.checkLabel === "Check in" ? "checkin" : "checkout",
                  returnTo,
                });
                const viewHref = buildAssetHref(row.id, { returnTo });

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
                    {columns.map((column, index) => {
                      const isLast = index === columns.length - 1;
                      const cellClass = [
                        rowClass,
                        column.cellPadding ?? "px-4",
                        getJustifyClass(column.justify),
                        isLast ? "border-r-0" : "",
                      ].join(" ");

                      if (column.id === "select") {
                        return (
                          <div key={column.id} className={cellClass}>
                            <span className={isSelected
                              ? "flex h-5 w-5 items-center justify-center rounded-full border border-[#F69629] bg-[#F69629]"
                              : "flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white/80 dark:border-[#5a6267] dark:bg-[#2f3437]"}
                            >
                              <span className={isSelected ? "h-2.5 w-2.5 rounded-full bg-white" : "h-2.5 w-2.5 rounded-full bg-transparent"} />
                            </span>
                          </div>
                        );
                      }

                      if (column.id === "assetTag") {
                        return (
                          <div key={column.id} className={cellClass}>
                            <span className="block truncate text-sm font-semibold text-[#b56613] dark:text-[#ffd7ab]">{row.assetTag}</span>
                          </div>
                        );
                      }

                      if (column.id === "assetName") {
                        return (
                          <div key={column.id} className={cellClass}>
                            <span className="block min-w-0 truncate whitespace-nowrap text-sm font-medium text-slate-950 dark:text-slate-100">{row.assetName}</span>
                          </div>
                        );
                      }

                      if (column.id === "status") {
                        return (
                          <div key={column.id} className={cellClass}>
                            {row.status ? <AssetStatusPill color={row.status.color} label={row.status.label} /> : <span className="text-sm text-slate-500 dark:text-slate-400">No status</span>}
                          </div>
                        );
                      }

                      if (column.id === "user") {
                        return (
                          <div key={column.id} className={cellClass}>
                            <span className="block truncate text-sm text-slate-600 dark:text-slate-300">{row.user}</span>
                          </div>
                        );
                      }

                      if (column.id === "serialNumber") {
                        return (
                          <div key={column.id} className={cellClass}>
                            <span className="block truncate text-sm font-semibold text-[#b56613] dark:text-[#ffd7ab]">{row.serialNumber}</span>
                          </div>
                        );
                      }

                      return (
                        <div key={column.id} className={cellClass} onClick={(event) => event.stopPropagation()}>
                          <div className="flex h-full w-full flex-nowrap items-center justify-end gap-2 overflow-hidden">
                            <div className="flex justify-end" style={{ width: SECONDARY_ACTION_STYLE.width }}>
                              <ActionLink href={viewHref} isSelected={isSelected} label="View" sizeStyle={SECONDARY_ACTION_STYLE} style={VIEW_ACTIVE_STYLE} />
                            </div>
                            <div className="flex justify-end" style={{ width: PRIMARY_ACTION_STYLE.width }}>
                              <ActionLink href={checkHref} isSelected={isSelected} label={row.checkLabel} sizeStyle={PRIMARY_ACTION_STYLE} style={CHECK_ACTIVE_STYLE} />
                            </div>
                            <div className="flex justify-end" style={{ width: DELETE_ACTION_STYLE.width }}>
                              <DeleteButton deleteAction={deleteAction} isSelected={isSelected} returnTo={returnTo} row={row} />
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
      )}
    </div>
  );
}
