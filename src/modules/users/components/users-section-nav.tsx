import Link from "next/link";

type UsersSectionNavProps = {
  active: "organization-users" | "guest-profiles";
};

export function UsersSectionNav({ active }: UsersSectionNavProps) {
  const linkClass = (key: UsersSectionNavProps["active"]) =>
    active === key
      ? "rounded-full bg-[#F69629] px-4 py-2 text-sm font-medium text-white dark:text-[#2F3437]"
      : "rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-[rgba(246,150,41,0.12)] hover:text-[#b56613] dark:text-slate-300 dark:hover:bg-[rgba(246,150,41,0.18)] dark:hover:text-[#ffd1a0]";

  return (
    <nav aria-label="Users sections" className="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white/80 p-2 dark:border-[#4b5255] dark:bg-[#2f3437]">
      <Link className={linkClass("organization-users")} href="/users?view=users">Organization users</Link>
      <Link className={linkClass("guest-profiles")} href="/users/guests">Guest profiles</Link>
    </nav>
  );
}
