"use client";
import { useId, useState } from "react";
import { Info } from "lucide-react";

export function PreparationHeading() {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <div className="flex items-center justify-between gap-3">
    <h2 className="text-2xl font-semibold">Workspace Preparation</h2>
    <div className="relative shrink-0" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="Workspace preparation information" aria-describedby={id}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-[#b56613] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 dark:border-slate-600 dark:text-[#ffd1a0]"
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        <Info className="h-5 w-5" aria-hidden="true" />
      </button>
      <div id={id} role="tooltip" hidden={!open}
        className="absolute right-0 top-11 z-20 w-80 max-w-[calc(100vw-6rem)] rounded-2xl border border-slate-300 bg-white p-4 text-sm shadow-panel dark:border-slate-600 dark:bg-[#34393c]">
        Inspection checks connectivity and the IT Assets schema without changing records.
        Activation rechecks compatibility and asks the supervisor to restart with the selected connection.
        Readiness is verified afterward. Installation and workspace accounts remain separate.
      </div>
    </div>
  </div>;
}
