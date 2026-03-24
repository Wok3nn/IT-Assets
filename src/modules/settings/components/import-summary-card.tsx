import type { ImportSummary } from "./import-export.types";

type ImportSummaryCardProps = {
  kind: "assets" | "users";
  importSummary: ImportSummary;
};

export function ImportSummaryCard({ kind, importSummary }: ImportSummaryCardProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-[#4b5255] dark:bg-[#34393c]">
      <div><h4 className="text-base font-semibold text-slate-950 dark:text-slate-100">Import summary</h4><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review the result before uploading another file.</p></div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-3 text-sm dark:border-[#4b5255] dark:bg-[#2f3437]"><span className="text-slate-500 dark:text-slate-400">Rows read</span><p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">{importSummary.totalRowsRead}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-3 text-sm dark:border-[#4b5255] dark:bg-[#2f3437]"><span className="text-slate-500 dark:text-slate-400">Imported</span><p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">{importSummary.rowsImported}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-3 text-sm dark:border-[#4b5255] dark:bg-[#2f3437]"><span className="text-slate-500 dark:text-slate-400">Skipped</span><p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">{importSummary.rowsSkipped}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-3 text-sm dark:border-[#4b5255] dark:bg-[#2f3437]"><span className="text-slate-500 dark:text-slate-400">Failed</span><p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">{importSummary.rowsFailed}</p></div>
      </div>
      {kind === "assets" ? <div className="grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-3 text-sm dark:border-[#4b5255] dark:bg-[#2f3437]"><span className="text-slate-500 dark:text-slate-400">Assigned to users</span><p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">{importSummary.assetsAssignedToUsers ?? 0}</p></div><div className="rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-3 text-sm dark:border-[#4b5255] dark:bg-[#2f3437]"><span className="text-slate-500 dark:text-slate-400">Left unassigned</span><p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">{importSummary.assetsLeftUnassigned ?? 0}</p></div></div> : null}
      {importSummary.warnings.length > 0 ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">{importSummary.warnings.map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)}</div> : null}
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">{importSummary.rowResults.slice(0, 12).map((result, index) => <p key={`${result.status}-${result.rowNumber}-${index}`}>Row {result.rowNumber} [{result.status}]: {result.messages.join(" ")}</p>)}</div>
    </div>
  );
}
