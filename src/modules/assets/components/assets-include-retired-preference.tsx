"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const INCLUDE_RETIRED_STORAGE_KEY = "assets-include-retired";

export function AssetsIncludeRetiredPreference({
  hasIncludeRetiredParam,
  includeRetired,
}: {
  hasIncludeRetiredParam: boolean;
  includeRetired: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (hasIncludeRetiredParam) {
      window.localStorage.setItem(INCLUDE_RETIRED_STORAGE_KEY, includeRetired ? "true" : "false");
      return;
    }

    if (window.localStorage.getItem(INCLUDE_RETIRED_STORAGE_KEY) === "true") {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("includeRetired", "true");
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    }
  }, [hasIncludeRetiredParam, includeRetired, pathname, router, searchParams]);

  return null;
}
