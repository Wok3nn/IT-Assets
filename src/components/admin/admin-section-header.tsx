import type { ReactNode } from "react";

export function AdminSectionHeader({
  title,
  summary,
  actions,
}: {
  title: ReactNode;
  summary: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">{title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{summary}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
