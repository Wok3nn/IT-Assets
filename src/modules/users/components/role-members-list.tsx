import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ScopeBadges } from "./scope-badges";

type RoleMember = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  canLogin: boolean;
  lastLoginAt: Date | null;
  _count: { assets: number; auditEntries: number };
  userScopes: Array<{ scope: { id: string; name: string; colorHex: string | null; colorMode: string | null } }>;
};

export function RoleMembersList({
  selectedRoleName,
  selectedRoleKey,
  searchQuery,
  roleMembers,
  onDelete,
  buildEditHref,
}: {
  selectedRoleName: string;
  selectedRoleKey: string;
  searchQuery: string;
  roleMembers: RoleMember[];
  onDelete: (userId: string) => JSX.Element;
  buildEditHref: (userId: string) => string;
}) {
  return (
    <div className="space-y-4">
      <form action="/users" className="flex flex-col gap-3 md:flex-row"><input name="view" type="hidden" value="roles" /><input name="roleKey" type="hidden" value={selectedRoleKey} /><input defaultValue={searchQuery} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-100 dark:focus:border-[#F69629]/70" name="q" placeholder={`Search ${selectedRoleName} users by name or email`} type="search" /><Button className="md:min-w-32" type="submit">Search</Button></form>
      {roleMembers.length === 0 ? <div className="rounded-3xl border border-dashed border-[#ece7df] bg-[#f8f9fb] px-5 py-8 text-center text-sm text-slate-500 dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)] dark:text-slate-400">{searchQuery ? "No users matched that search." : "No users are currently assigned to this role."}</div> : <div className="space-y-3">{roleMembers.map((user) => <article key={user.id} className="rounded-[28px] border border-[#ece7df] bg-white/96 p-5 transition hover:border-[#f0c48d] dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_16px_30px_rgba(0,0,0,0.18)] dark:hover:border-[#f0a853]"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0 flex-1 space-y-3"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{user.name}</h3><span className={user.isActive ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"}>{user.isActive ? "Active" : "Inactive"}</span><span className={user.canLogin ? "rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}>{user.canLogin ? "Login enabled" : "No login"}</span></div><div className="space-y-1 text-sm text-slate-500 dark:text-slate-400"><p>{user.email}</p><p>Last login {user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "not recorded yet"}</p><p>{user._count.assets} assigned {user._count.assets === 1 ? "asset" : "assets"}</p></div><div className="flex flex-wrap gap-2"><ScopeBadges scopes={user.userScopes.map(({ scope }) => scope)} /></div></div><div className="grid gap-3 sm:grid-cols-2 xl:min-w-56"><Link href={buildEditHref(user.id)}><Button className="w-full" type="button" variant="secondary">Edit</Button></Link>{onDelete(user.id)}</div></div></article>)}</div>}
    </div>
  );
}
