import { Search } from "lucide-react";

import { buildAssetsUrl } from "@/modules/assets/assets-routing";

import { Button } from "../ui/button";

type HeaderAssetSearchProps = {
  defaultValue?: string;
  className?: string;
  compact?: boolean;
  hiddenFields?: Record<string, string | number | boolean | null | undefined>;
};

const searchInputClassName =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white/92 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#F69629]/65 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#F69629]/65";

export function HeaderAssetSearch({ defaultValue, className, compact = false, hiddenFields }: HeaderAssetSearchProps) {
  return (
    <form action={buildAssetsUrl()} className={className} method="get">
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            value === null || value === undefined || value === "" ? null : <input key={name} name={name} type="hidden" value={String(value)} />
          ))
        : null}
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="relative w-full min-w-0 sm:min-w-[280px] xl:min-w-[320px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            className={searchInputClassName}
            defaultValue={defaultValue}
            name="q"
            placeholder={compact ? "Search assets" : "Search assets by model, make, tag, or serial"}
            type="search"
          />
        </div>
        <Button className="h-11 whitespace-nowrap px-4" type="submit" variant="secondary">
          Search assets
        </Button>
      </div>
    </form>
  );
}
