import type { ChangeEvent, ReactNode } from "react";

import {
  EXPORT_FORMATS,
  IMPORT_FILE_ACCEPT,
  type ImportFormat,
} from "@/modules/settings/import-export.shared";

import { fieldClass, cardClass, exportLinkClass } from "./import-export.styles";

type ImportCardShellProps = {
  title: string;
  description: string;
  exportHref: string;
  importNote?: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  exportLabel?: string;
  exportFormats?: ImportFormat[];
  importAccept?: string;
  importLabel?: string;
  formatGuidance?: string;
  skipNote?: string;
  showDescription?: boolean;
  showSupportPanels?: boolean;
  children?: ReactNode;
};

function formatExportLabel(format: ImportFormat) {
  return format.toUpperCase();
}

export function ImportCardShell({
  title,
  description,
  exportHref,
  importNote,
  onFileChange,
  exportLabel = "Export",
  exportFormats = EXPORT_FORMATS,
  importAccept = IMPORT_FILE_ACCEPT,
  importLabel = "Import CSV, XLSX, or JSON",
  formatGuidance = "CSV/XLSX are best for spreadsheet editing. JSON is best for full-fidelity structured transfers.",
  skipNote = "Existing items are skipped during import.",
  showDescription = true,
  showSupportPanels = true,
  children,
}: ImportCardShellProps) {
  return (
    <section className={cardClass}>
      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-8">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{title}</h3>
          {showDescription ? <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {exportFormats.map((format) => (
              <span
                className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300"
                key={format}
              >
                {format}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0 space-y-3 xl:min-w-[19rem] xl:max-w-sm xl:border-l xl:border-[#e7e1d8] xl:pl-6 xl:text-right dark:xl:border-[#4b5255]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Export options</p>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {exportFormats.map((format) => (
              <a
                className={exportLinkClass}
                href={`${exportHref}?format=${format}`}
                key={format}
              >
                {exportLabel} {formatExportLabel(format)}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4 lg:mt-5">
        {importNote ? <div className="rounded-2xl border border-[#f2c28c] bg-[rgba(246,150,41,0.12)] px-4 py-3 text-sm text-[#9a5a13] dark:border-[#7f5a2d] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">{importNote}</div> : null}
        {showSupportPanels ? <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-slate-100">Format guidance</p>
            <p className="mt-1">{formatGuidance}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-slate-100">Import behavior</p>
            <p className="mt-1">{skipNote}</p>
          </div>
        </div> : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{importLabel}</span>
          <input accept={importAccept} className={fieldClass} onChange={onFileChange} type="file" />
        </label>

        {children}
      </div>
    </section>
  );
}
