import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AdminEmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-[#ece7df] bg-[#f8f9fb] px-5 py-8 text-center text-sm text-slate-500 dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)] dark:text-slate-400",
        className,
      )}
    >
      {children}
    </div>
  );
}
