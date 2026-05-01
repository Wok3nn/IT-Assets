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
  userRoles: Array<{ role: { name: string } }>;
  userScopes: Array<{ scope: { id: string; name: string; colorHex: string | null; colorMode: string | null } }>;
  _count: { assets: number; auditEntries: number };
};

type PageSizeOption = {
  href: string;
  isActive: boolean;
  value: 25 | 50;
};

export function UsersDirectoryList({
  users,
  totalUsers,
  currentPage,
  totalPages,
  pageEnd,
  pageSize,
  pageSizeOptions,
  previousPageHref,
  nextPageHref,
  currentUserId,
  buildEditHref,
  buildViewHref,
  canEditUsers,
  renderDeleteForm,
}: {
  users: DirectoryUser[];
  totalUsers: number;
  currentPage: number;
  totalPages: number;
  pageEnd: number;
  pageSize: 25 | 50;
  pageSizeOptions: PageSizeOption[];
  previousPageHref: string | null;
  nextPageHref: string | null;
  currentUserId: string;
  buildEditHref: (userId: string) => string;
  buildViewHref: (userId: string) => string;
  canEditUsers: boolean;
  renderDeleteForm: (userId: string, canDelete: boolean) => ReactNode;
}) {
  if (users.length === 0) {
    return <div className="rounded-3xl border border-dashed border-[#ece7df] bg-[#f8f9fb] px-5 py-8 text-center text-sm text-slate-500 dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)] dark:text-slate-400">No users matched the current filters.</div>;
  }

  const pageStart = totalUsers === 0 ? 0 : (currentPage - 1) * pageSize + 1;

  return (
    <div className="w-full overflow-hidden rounded-[28px] border border-[#ece7df] dark:border-[#4b5255]">
      <div className="w-full overflow-x-auto">
        <table className="min-w-[900px] w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead className="bg-[#f8f9fb] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">User</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Role</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Assets</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Departments</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Access</th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-500 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white/96 dark:divide-slate-800 dark:bg-[#34393c] dark:shadow-[0_16px_30px_rgba(0,0,0,0.18)]">
            {users.map((user) => {
              const canDelete = user.id !== currentUserId && user._count.assets === 0 && user._count.auditEntries === 0;
              const primaryRole = user.userRoles[0]?.role.name ?? "Unassigned";

              return (
                <tr key={user.id} className="align-middle">
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      <Link
                        className="font-medium leading-5 text-slate-950 underline-offset-4 transition hover:text-[#b56613] hover:underline dark:text-slate-100 dark:hover:text-[#ffd1a0]"
                        href={buildViewHref(user.id)}
                      >
                        {user.name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {primaryRole}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                    {user._count.assets} assigned
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <ScopeBadges scopes={user.userScopes.map(({ scope }) => scope)} />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={user.isActive ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"}>{user.isActive ? "Active" : "Inactive"}</span>
                      <span className={user.canLogin ? "rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}>{user.canLogin ? "Login enabled" : "No login"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <Link href={buildViewHref(user.id)}>
                        <Button className="px-3 py-1.5 text-xs" type="button" variant="secondary">View</Button>
                      </Link>
                      {canEditUsers ? (
                        <Link href={buildEditHref(user.id)}>
                          <Button className="px-3 py-1.5 text-xs" type="button" variant="secondary">Edit</Button>
                        </Link>
                      ) : null}
                      {renderDeleteForm(user.id, canDelete)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-[#f8f9fb] px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-[#2f3437] dark:text-slate-300 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <p>Showing {pageStart}-{pageEnd} of {totalUsers} users</p>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Rows</span>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 dark:border-[#4b5255] dark:bg-[#34393c]">
              {pageSizeOptions.map((option) => (
                <Link key={option.value} href={option.href}>
                  <span className={option.isActive ? "inline-flex rounded-full bg-[#F69629] px-3 py-1 text-xs font-medium text-white dark:text-[#2F3437]" : "inline-flex rounded-full px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-[rgba(246,150,41,0.12)] hover:text-[#b56613] dark:text-slate-300 dark:hover:bg-[rgba(246,150,41,0.18)] dark:hover:text-[#ffd1a0]"}>
                    {option.value}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex items-center gap-2">
            {previousPageHref ? <Link href={previousPageHref}><Button className="px-3 py-1.5 text-xs" type="button" variant="secondary">Previous</Button></Link> : <Button className="px-3 py-1.5 text-xs" disabled type="button" variant="secondary">Previous</Button>}
            {nextPageHref ? <Link href={nextPageHref}><Button className="px-3 py-1.5 text-xs" type="button" variant="secondary">Next</Button></Link> : <Button className="px-3 py-1.5 text-xs" disabled type="button" variant="secondary">Next</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
