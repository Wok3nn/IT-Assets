"use client";

import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "assets-filter-panel-visible";

type AssetsFilterPanelProps = {
  activeFilterCount: number;
  children: ReactNode;
};

export function AssetsFilterPanel({ activeFilterCount, children }: AssetsFilterPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (storedValue === "shown") {
        setIsVisible(true);
      } else if (storedValue === "hidden") {
        setIsVisible(false);
      }
    } catch {
      // Keep the compact default when storage is unavailable.
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, isVisible ? "shown" : "hidden");
  }, [isHydrated, isVisible]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Filters</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {hasActiveFilters ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied` : "No advanced filters applied"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!isVisible && hasActiveFilters ? (
            <span className="inline-flex h-9 items-center rounded-full border border-[#f6b766]/60 bg-[#fff7ed] px-3 text-xs font-medium text-[#9a5a12] dark:border-[#9b6a36]/70 dark:bg-[#3d3327] dark:text-[#ffd6a6]">
              Active filters
            </span>
          ) : null}
          <Button
            aria-expanded={isVisible}
            aria-controls="asset-filters"
            onClick={() => setIsVisible((current) => !current)}
            type="button"
            variant="secondary"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
              {isVisible ? "Hide filters" : "Show filters"}
            </span>
          </Button>
        </div>
      </div>
      {isVisible ? children : null}
    </div>
  );
}
