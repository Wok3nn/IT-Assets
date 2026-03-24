import type { ReactNode } from "react";

import { CsvPreviewTable } from "./csv-preview-table";
import type { PreviewHeader, ValidationState } from "./import-export.types";

type ValidationSummaryProps = {
  validation: ValidationState;
  previewHeaders: PreviewHeader[];
  previewRows: string[][];
  actionBar: ReactNode;
};

export function ValidationSummary({ validation, previewHeaders, previewRows, actionBar }: ValidationSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(16, 185, 129, 0.45)", backgroundColor: "rgba(16, 185, 129, 0.14)" }}>
          <span className="text-[#064e3b] dark:text-slate-300">Valid rows</span>
          <p className="mt-1 text-lg font-semibold text-[#047857] dark:text-[#86efac]">{validation.validRows}</p>
        </div>
        <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(244, 63, 94, 0.45)", backgroundColor: "rgba(244, 63, 94, 0.14)" }}>
          <span className="text-[#881337] dark:text-slate-300">Rows with errors</span>
          <p className="mt-1 text-lg font-semibold text-[#be123c] dark:text-[#fda4af]">{validation.rowErrors.length}</p>
        </div>
        <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(245, 158, 11, 0.5)", backgroundColor: "rgba(245, 158, 11, 0.16)" }}>
          <span className="text-[#78350f] dark:text-slate-300">Warnings</span>
          <p className="mt-1 text-lg font-semibold text-[#b45309] dark:text-[#fcd34d]">{validation.rowWarnings.length}</p>
        </div>
      </div>

      {validation.globalErrors.length > 0 ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{validation.globalErrors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}</div> : null}
      {validation.rowErrors.length > 0 ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><p className="font-medium">Validation issues</p><div className="mt-2 space-y-2">{validation.rowErrors.slice(0, 8).map((rowError) => <p key={`row-error-${rowError.rowNumber}`}>Row {rowError.rowNumber}: {rowError.messages.join(" ")}</p>)}</div></div> : null}
      {validation.rowWarnings.length > 0 ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><p className="font-medium">Warnings</p><div className="mt-2 space-y-2">{validation.rowWarnings.slice(0, 8).map((warning) => <p key={`warning-${warning.rowNumber}`}>Row {warning.rowNumber}: {warning.messages.join(" ")}</p>)}</div></div> : null}

      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Preview</p>
        <CsvPreviewTable previewHeaders={previewHeaders} previewRows={previewRows} />
      </div>

      {actionBar}
    </div>
  );
}
