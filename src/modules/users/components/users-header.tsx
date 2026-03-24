import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";

type ViewMode = "roles" | "users";

export function UsersHeader({
  view,
  selectedRoleName,
  rolesViewHref,
  usersViewHref,
}: {
  view: ViewMode;
  selectedRoleName: string | null;
  rolesViewHref: string;
  usersViewHref: string;
}) {
  return (
    <PageHero>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Users</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{view === "roles" && selectedRoleName ? `${selectedRoleName} members` : view === "users" ? "User directory" : "Roles and access"}</h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{view === "roles" ? (selectedRoleName ? "This view lists the people assigned to one role so membership stays easy to scan and search." : "Start at the role level. Open a card to see who belongs in each access tier.") : "Browse the full user directory with filters for role, department, login access, status, and sort order."}</p>
        </div>
        <div className="inline-flex rounded-full border border-[#ece7df] bg-[#f7f8fa] p-1 shadow-inner dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_16px_30px_rgba(0,0,0,0.18)]">
          <Link href={rolesViewHref} className={view === "roles" ? "rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-950 shadow-sm dark:bg-[#F69629] dark:text-[#2F3437]" : "rounded-full px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-[rgba(246,150,41,0.1)] hover:text-[#b56613] dark:text-slate-300 dark:hover:bg-[rgba(246,150,41,0.18)] dark:hover:text-[#ffd1a0]"}>Roles</Link>
          <Link href={usersViewHref} className={view === "users" ? "rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-950 shadow-sm dark:bg-[#F69629] dark:text-[#2F3437]" : "rounded-full px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-[rgba(246,150,41,0.1)] hover:text-[#b56613] dark:text-slate-300 dark:hover:bg-[rgba(246,150,41,0.18)] dark:hover:text-[#ffd1a0]"}>Users</Link>
        </div>
      </div>
    </PageHero>
  );
}
