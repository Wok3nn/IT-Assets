import type { PreviewHeader } from "./import-export.types";

type CsvPreviewTableProps = {
  previewHeaders: PreviewHeader[];
  previewRows: string[][];
};

export function CsvPreviewTable({ previewHeaders, previewRows }: CsvPreviewTableProps) {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#4b5255]">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[#eef2f6] dark:bg-[#34393c]">
          <tr>
            {previewHeaders.map((header) => <th key={header.key} className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 dark:border-[#4b5255] dark:text-slate-200">{header.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {previewRows.map((row, rowIndex) => (
            <tr key={`preview-row-${rowIndex}`} className="bg-white dark:bg-[#2f3437]">
              {row.map((value, cellIndex) => <td key={`preview-cell-${rowIndex}-${cellIndex}`} className="border-t border-slate-200 px-3 py-2 text-slate-600 dark:border-[#4b5255] dark:text-slate-300">{value || "-"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
