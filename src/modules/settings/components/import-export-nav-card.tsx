import Link from "next/link";

type ImportExportNavCardProps = {
  href: string;
  order: number;
  title: string;
  description: string;
  actionLabel?: string;
};

const navCardClass = "group block rounded-3xl border border-[#ece7df] bg-white/92 p-5 shadow-panel backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#f0c48d] hover:shadow-[0_22px_42px_rgba(246,150,41,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69629]/40 dark:border-[#4b5255] dark:bg-[#34393c]/92 dark:hover:border-[#f0a853] dark:hover:shadow-[0_18px_34px_rgba(0,0,0,0.22)]";

export function ImportExportNavCard({
  href,
  order,
  title,
  description,
  actionLabel = "Open",
}: ImportExportNavCardProps) {
  return (
    <Link className={navCardClass} href={href}>
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-200 bg-white/80 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-300">
              {order}
            </span>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Recommended order</p>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-950 transition group-hover:text-[#b56613] dark:text-slate-100 dark:group-hover:text-[#ffd1a0]">
            {title}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>

        <div>
          <span className="inline-flex rounded-full bg-[rgba(246,150,41,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b56613] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffd1a0]">
            {actionLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
