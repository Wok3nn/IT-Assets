import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { ScopeBadges } from "./scope-badges";
import { usersFieldClassName } from "./users.styles";

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

function AccessBadge({ isActive, canLogin }: Pick<RoleMember, "isActive" | "canLogin">) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={isActive ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"}>
        {isActive ? "Active" : "Inactive"}
      </span>
      <span className={canLogin ? "rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}>
        {canLogin ? "Login enabled" : "No login"}
      </span>
    </div>
  );
}

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
  onDelete: (userId: string) => ReactNode;
  buildEditHref: (userId: string) => string;
}) {
  return (
    <div className="space-y-4">
      <form action="/users" className="flex flex-col gap-3 md:flex-row" key={`role-members-form-${selectedRoleKey ?? "none"}`}>
        <input name="view" readOnly type="hidden" value="roles" />
        <input name="roleKey" readOnly type="hidden" value={selectedRoleKey ?? ""} />
        <input
          defaultValue={searchQuery ?? ""}
          className={`${usersFieldClassName} w-full`}
          name="q"
          placeholder={`Search ${selectedRoleName} users by name or email`}
          type="search"
        />
        <Button className="md:min-w-32" type="submit">Search</Button>
      </form>

      {roleMembers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#ece7df] bg-[#f8f9fb] px-5 py-8 text-center text-sm text-slate-500 dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)] dark:text-slate-400">
          {searchQuery ? "No users matched that search." : "No users are currently assigned to this role."}
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-[28px] border border-[#ece7df] dark:border-[#4b5255]">
          <div className="w-full overflow-x-auto">
            <table className="min-w-[900px] w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-[#f8f9fb] dark:bg-[#34393c] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">User</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Assets</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Departments</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Access</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white/96 dark:divide-slate-800 dark:bg-[#34393c] dark:shadow-[0_16px_30px_rgba(0,0,0,0.18)]">
                {roleMembers.map((user) => (
                  <tr key={user.id} className="align-middle">
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="font-medium leading-5 text-slate-950 dark:text-slate-100">{user.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                      </div>
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
                      <AccessBadge canLogin={user.canLogin} isActive={user.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <Link href={buildEditHref(user.id)}>
                          <Button className="px-3 py-1.5 text-xs" type="button" variant="secondary">Edit</Button>
                        </Link>
                        {onDelete(user.id)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-[#f8f9fb] px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-[#2f3437] dark:text-slate-300 lg:flex-row lg:items-center lg:justify-between">
            <p>Showing {roleMembers.length} {roleMembers.length === 1 ? "user" : "users"} in {selectedRoleName}</p>
            <div className="flex items-center gap-2 lg:justify-end">
              <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-300">
                Role filter active
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
