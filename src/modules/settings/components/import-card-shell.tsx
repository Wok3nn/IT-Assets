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
  children,
}: ImportCardShellProps) {
  return (
    <section className={cardClass}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {exportFormats.map((format) => (
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  format === "json"
                    ? "border-[#f2c28c] bg-[rgba(246,150,41,0.12)] text-[#9a5a13] dark:border-[#9d6930] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]"
                    : "border-slate-200 bg-white/80 text-slate-600 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300"
                }`}
                key={format}
              >
                {format}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0 space-y-3 xl:max-w-sm xl:text-right">
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

      <div className="mt-5 space-y-4">
        {importNote ? <div className="rounded-2xl border border-[#f2c28c] bg-[rgba(246,150,41,0.12)] px-4 py-3 text-sm text-[#9a5a13] dark:border-[#7f5a2d] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">{importNote}</div> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-slate-100">Format guidance</p>
            <p className="mt-1">{formatGuidance}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm text-slate-600 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-slate-100">Import behavior</p>
            <p className="mt-1">{skipNote}</p>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{importLabel}</span>
          <input accept={importAccept} className={fieldClass} onChange={onFileChange} type="file" />
        </label>

        {children}
      </div>
    </section>
  );
}
