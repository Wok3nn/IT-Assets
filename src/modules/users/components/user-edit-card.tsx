import Link from "next/link";

import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

import { usersFieldClassName, usersInsetSectionClassName, usersScopeOptionClassName } from "./users.styles";

type RoleOption = { id: string; key: string; name: string };
type ScopeOption = { id: string; name: string; slug: string };
type EditUser = {
  id: string;
  name: string;
  email: string;
  canLogin: boolean;
  isActive: boolean;
  userRoles: Array<{ role: { key: string } }>;
  userScopes: Array<{ scope: { id: string } }>;
};

export function UserEditCard({
  action,
  cancelHref,
  editUser,
  roleOptions,
  scopeOptions,
  returnTo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  editUser: EditUser;
  roleOptions: RoleOption[];
  scopeOptions: ScopeOption[];
  returnTo: string;
}) {
  return (
    <PanelCard>
      <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Edit user</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Update this user on its own page so the directory remains a focused list view.
      </p>
      <form action={action} className="mt-5 space-y-4">
        <input name="userId" type="hidden" value={editUser.id} />
        <input name="returnTo" type="hidden" value={returnTo} />
        <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">Display name</span><input required minLength={2} maxLength={80} name="name" defaultValue={editUser.name} className={usersFieldClassName} type="text" /></label>
        <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span><input required maxLength={160} name="email" defaultValue={editUser.email} className={usersFieldClassName} type="email" /></label>
        <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">Role</span><select defaultValue={editUser.userRoles[0]?.role.key ?? roleOptions[0]?.key ?? ""} name="roleKey" className={usersFieldClassName}>{roleOptions.map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}</select></label>
        <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">Status</span><select defaultValue={editUser.isActive ? "true" : "false"} name="isActive" className={usersFieldClassName}><option value="true">Active</option><option value="false">Inactive</option></select></label>
        <div className={usersInsetSectionClassName}><input id="allow-login-edit" className="ui-switch peer align-top" defaultChecked={editUser.canLogin} name="allowLogin" type="checkbox" value="true" /><label className="ml-3 inline-block cursor-pointer align-top" htmlFor="allow-login-edit"><span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Allow login</span><span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">Turn this off for tracked contacts who should never sign in.</span></label><div className={`mt-4 ${editUser.canLogin ? "block" : "hidden"} peer-checked:block`}><label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">Temporary password</span><input minLength={8} maxLength={128} name="password" className={usersFieldClassName} placeholder={editUser.canLogin ? "Leave blank to keep the current password" : "Required when enabling login"} type="password" /></label></div></div>
        <div className={usersInsetSectionClassName}><div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">Departments</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update which departments this user belongs to.</p></div><div className="mt-4 space-y-2">{scopeOptions.length === 0 ? <p className="rounded-2xl border border-dashed border-[#ece7df] px-4 py-3 text-sm text-slate-500 dark:border-[#4b5255] dark:text-slate-400">No groups exist yet.</p> : scopeOptions.map((scope) => { const isChecked = editUser.userScopes.some((userScope) => userScope.scope.id === scope.id); return <label key={scope.id} className={usersScopeOptionClassName}><input defaultChecked={isChecked} className="ui-check" name="scopeIds" type="checkbox" value={scope.id} /><span className="flex-1">{scope.name}</span><span className="text-xs text-slate-500 dark:text-slate-400">{scope.slug}</span></label>; })}</div></div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href={cancelHref}>
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
          <Button type="submit">Save user</Button>
        </div>
      </form>
    </PanelCard>
  );
}
