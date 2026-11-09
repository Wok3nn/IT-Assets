import type { ReactNode } from "react";
import Link from "next/link";
import { Database, Layers } from "lucide-react";

// Never load inventory branding, users or permissions in this shell.
export function InstallationShell({
  children,
  navigation,
  context,
}: {
  children?: ReactNode;
  navigation: ReactNode;
  context: string;
}) {
  return (
    <div className="min-h-screen bg-[#f5f3ef] text-slate-800 dark:bg-[#24292c] dark:text-slate-100 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#2d3336] lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link
          href="/installation"
          prefetch={false}
          className="flex items-center gap-3 text-xl font-semibold"
        >
          <Layers aria-hidden="true" /> IT Assets
        </Link>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          Installation &amp; database setup
        </p>
        <nav
          aria-label="Installation navigation"
          className="mt-7 flex flex-wrap gap-3 lg:flex-col"
        >
          {navigation}
        </nav>
        <p className="mt-8 flex items-start gap-2 text-sm">
          <Database className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{context}</span>
        </p>
      </aside>
      <main id="main-content" className="min-w-0 space-y-6 p-4 sm:p-6 xl:p-10">
        {children}
      </main>
    </div>
  );
}
