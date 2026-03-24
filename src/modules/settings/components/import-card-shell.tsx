import type { ChangeEvent, ReactNode } from "react";

import { fieldClass, cardClass, exportLinkClass } from "./import-export.styles";

type ImportCardShellProps = {
  title: string;
  description: string;
  exportHref: string;
  importNote?: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  children?: ReactNode;
};

export function ImportCardShell({ title, description, exportHref, importNote, onFileChange, children }: ImportCardShellProps) {
  return (
    <section className={cardClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        <a className={exportLinkClass} href={exportHref}>Export CSV</a>
      </div>

      <div className="mt-5 space-y-4">
        {importNote ? <div className="rounded-2xl border border-[#f2c28c] bg-[rgba(246,150,41,0.12)] px-4 py-3 text-sm text-[#9a5a13] dark:border-[#7f5a2d] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">{importNote}</div> : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Import CSV</span>
          <input accept=".csv,text/csv" className={fieldClass} onChange={onFileChange} type="file" />
        </label>

        {children}
      </div>
    </section>
  );
}
