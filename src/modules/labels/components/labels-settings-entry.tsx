import Link from "next/link";

import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

import type { LabelTemplateSummary } from "../label-template.service";

export function LabelsSettingsEntry({ templates }: { templates: LabelTemplateSummary[] }) {
  const recentTemplates = templates.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PanelCard className="flex h-full flex-col justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Template library</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950 dark:text-slate-100">Browse label templates</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Open the shared Labels library to review saved template sizes, enabled asset fields, and future print-ready layouts in one place.</p>
          </div>
          <div><Link href="/labels"><Button type="button">Open library</Button></Link></div>
        </PanelCard>

        <PanelCard className="flex h-full flex-col justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Template setup</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950 dark:text-slate-100">Create a new template</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Start a new label definition with size, unit, orientation, and the initial text elements future visual editing will build on.</p>
          </div>
          <div><Link href="/labels/new"><Button type="button">New template</Button></Link></div>
        </PanelCard>

        <PanelCard className="flex h-full flex-col justify-between gap-4 md:col-span-2 xl:col-span-1">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Foundation status</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950 dark:text-slate-100">Phase 1 architecture</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Templates now save structured size metadata plus per-element positioning and text settings, which future preview, drag/drop, and print flows can reuse.</p>
          </div>
          <div className="rounded-2xl border border-[#ece7df] bg-[#f8f9fb] px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-300">
            <p><span className="font-semibold text-slate-900 dark:text-slate-100">{templates.length}</span> saved template{templates.length === 1 ? "" : "s"}</p>
          </div>
        </PanelCard>
      </div>

      <PanelCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Recent templates</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">This snapshot confirms the shared Labels library is the source of truth, while Settings remains the admin entry point.</p>
          </div>
          <Link href="/labels"><Button type="button" variant="ghost">View all templates</Button></Link>
        </div>

        <div className="mt-5 space-y-3">
          {recentTemplates.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#ece7df] px-4 py-5 text-sm text-slate-500 dark:border-[#4b5255] dark:text-slate-400">
              No templates exist yet. Create the first one to establish the reusable label foundation.
            </div>
          ) : recentTemplates.map((template) => (
            <div key={template.id} className="flex flex-col gap-3 rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#2f3437] lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-base font-semibold text-slate-950 dark:text-slate-100">{template.name}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{template.description || "No description yet."}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span>{template.width} x {template.height} {template.unit}</span>
                <Link href={`/labels/${template.id}/edit`}><Button type="button" variant="ghost">Edit</Button></Link>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}