import type { ReactNode } from "react";
import { PanelCard } from "@/components/layout/panel-card";

export function SettingsHelp({ children, label = "About these settings" }: { children: ReactNode; label?: string }) {
  return <details className="text-sm text-slate-600 dark:text-slate-300">
    <summary className="min-h-10 cursor-pointer py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">ⓘ {label}</summary>
    <div className="space-y-2 pb-3">{children}</div>
  </details>;
}

export function SettingsSection({ title, status, description, children, help, open = false }: {
  title: string; status: string; description: string; children?: ReactNode; help: ReactNode; open?: boolean;
}) {
  return <PanelCard><details open={open}>
    <summary className="min-h-11 cursor-pointer py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
      <span className="text-lg font-semibold">{title}</span>{" "}
      <span className="ml-2 inline-block text-sm font-normal text-slate-600 dark:text-slate-300">{status}</span>
    </summary>
    <div className="min-w-0 space-y-3 pt-2">
      <p className="text-sm">{description}</p>
      <SettingsHelp label={`About ${title.toLowerCase()}`}>{help}</SettingsHelp>
      {children}
    </div>
  </details></PanelCard>;
}

// Submit the existing server-approved value only after an explicit user choice.
// Keep review IDs and version checks in Form/the action; never use a hidden approval.
export function SettingsApproval({ value = "ENABLE", children }: { value?: string; children?: ReactNode }) {
  return <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm">
    <input type="checkbox" name="confirmation" value={value} required className="mt-1 h-4 w-4 shrink-0 accent-orange-500" />
    <span>{children}</span>
  </label>;
}
