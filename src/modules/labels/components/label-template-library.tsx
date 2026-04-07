import Link from "next/link";

import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

import { LABEL_TEMPLATE_FIELD_OPTIONS, type LabelTemplateFieldKey } from "../label-template.shared";
import type { LabelTemplateSummary } from "../label-template.service";

function formatTemplateSize(width: number, height: number, unit: string) {
  const unitLabel = unit === "millimeters" ? "mm" : unit === "centimeters" ? "cm" : unit === "inches" ? "in" : unit;
  return `${width} x ${height} ${unitLabel}`;
}

function formatFieldSummary(fieldKeys: LabelTemplateFieldKey[]) {
  if (fieldKeys.length === 0) {
    return "No saved fields";
  }

  return fieldKeys
    .map((fieldKey) => LABEL_TEMPLATE_FIELD_OPTIONS.find((option) => option.key === fieldKey)?.label ?? fieldKey)
    .join(", ");
}

export function LabelTemplateLibrary({ templates }: { templates: LabelTemplateSummary[] }) {
  if (templates.length === 0) {
    return (
      <PanelCard>
        <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Template library</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Save label definitions here so future preview, print, and asset-level template selection flows can reuse the same library instead of rebuilding layouts ad hoc.</p>
        <div className="mt-6 rounded-3xl border border-dashed border-[#ece7df] px-5 py-10 text-center dark:border-[#4b5255]">
          <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">No label templates yet</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Create the first template to establish a reusable label size and the initial asset fields that should appear on it.</p>
          <div className="mt-5 flex justify-center">
            <Link href="/labels/new"><Button type="button">New template</Button></Link>
          </div>
        </div>
      </PanelCard>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {templates.map((template) => (
        <PanelCard key={template.id} className="flex h-full flex-col justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">{template.name}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${template.isEnabled ? "bg-[rgba(34,197,94,0.12)] text-emerald-700 dark:bg-[rgba(34,197,94,0.16)] dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-[#4b5255] dark:text-slate-300"}`}>
                    {template.isEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{template.description || "No description yet. This template still has a reusable saved size and field definition."}</p>
              </div>
              <span className="rounded-full bg-[rgba(246,150,41,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">{template.orientation}</span>
            </div>

            <dl className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#ece7df] bg-[#f8f9fb] px-4 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]"><dt className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Size</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{formatTemplateSize(template.width, template.height, template.unit)}</dd></div>
              <div className="rounded-2xl border border-[#ece7df] bg-[#f8f9fb] px-4 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]"><dt className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Elements</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{template.elementCount}</dd></div>
              <div className="rounded-2xl border border-[#ece7df] bg-[#f8f9fb] px-4 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]"><dt className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Assigned assets</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{template.assetCount}</dd></div>
              <div className="rounded-2xl border border-[#ece7df] bg-[#f8f9fb] px-4 py-3 dark:border-[#4b5255] dark:bg-[#2f3437]"><dt className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Fields</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{formatFieldSummary(template.fieldKeys)}</dd></div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link href={`/labels/new?duplicateId=${template.id}`}><Button type="button" variant="ghost">Duplicate</Button></Link>
            <Link href={`/labels/${template.id}/edit`}><Button type="button">Edit template</Button></Link>
          </div>
        </PanelCard>
      ))}
    </div>
  );
}