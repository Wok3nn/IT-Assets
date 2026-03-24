import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ScopeBadges } from "./scope-badges";

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  canLogin: boolean;
  lastLoginAt: Date | null;
  userRoles: Array<{ role: { name: string } }>;
  userScopes: Array<{ scope: { id: string; name: string; colorHex: string | null; colorMode: string | null } }>;
  _count: { assets: number; auditEntries: number };
};

export function UsersDirectoryList({
  users,
  currentUserId,
  buildEditHref,
  renderDeleteForm,
}: {
  users: DirectoryUser[];
  currentUserId: string;
  buildEditHref: (userId: string) => string;
  renderDeleteForm: (userId: string, canDelete: boolean) => ReactNode;
}) {
  if (users.length === 0) {
    return <div className="rounded-3xl border border-dashed border-[#ece7df] bg-[#f8f9fb] px-5 py-8 text-center text-sm text-slate-500 dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)] dark:text-slate-400">No users matched the current filters.</div>;
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#ece7df] dark:border-[#4b5255]"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700"><thead className="bg-[#f8f9fb] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)]"><tr><th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Name</th><th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Role</th><th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Departments</th><th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Status</th><th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Last login</th><th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">Actions</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white/96 dark:divide-slate-800 dark:bg-[#34393c] dark:shadow-[0_16px_30px_rgba(0,0,0,0.18)]">{users.map((user) => { const canDelete = user.id !== currentUserId && user._count.assets === 0 && user._count.auditEntries === 0; const primaryRole = user.userRoles[0]?.role.name ?? "Unassigned"; return <tr key={user.id} className="align-top"><td className="px-4 py-4"><div className="space-y-1"><p className="font-medium text-slate-950 dark:text-slate-100">{user.name}</p><p className="text-slate-500 dark:text-slate-400">{user.email}</p></div></td><td className="px-4 py-4 text-slate-600 dark:text-slate-300">{primaryRole}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><ScopeBadges scopes={user.userScopes.map(({ scope }) => scope)} /></div></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><span className={user.isActive ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"}>{user.isActive ? "Active" : "Inactive"}</span><span className={user.canLogin ? "rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}>{user.canLogin ? "Login enabled" : "No login"}</span></div></td><td className="px-4 py-4 text-slate-500 dark:text-slate-400">{user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "Not recorded"}</td><td className="px-4 py-4"><div className="flex justify-end gap-3"><Link href={buildEditHref(user.id)}><Button type="button" variant="secondary">Edit</Button></Link>{renderDeleteForm(user.id, canDelete)}</div></td></tr>; })}</tbody></table></div></div>
  );
}
