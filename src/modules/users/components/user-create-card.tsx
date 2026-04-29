import { Button } from "@/components/ui/button";
import { PanelCard } from "@/components/layout/panel-card";

import { usersFieldClassName, usersInsetSectionClassName, usersScopeOptionClassName } from "./users.styles";

type RoleOption = { id: string; key: string; name: string };
type ScopeOption = { id: string; name: string; slug: string };

export function UserCreateCard({
  action,
  roleOptions,
  scopeOptions,
  defaultRoleKey,
}: {
  action: (formData: FormData) => void | Promise<void>;
  roleOptions: RoleOption[];
  scopeOptions: ScopeOption[];
  defaultRoleKey: string;
}) {
  return (
    <PanelCard>
      <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">New user</h2>
      <form action={action} className="mt-5 space-y-4">
        <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">Display name</span><input required minLength={2} maxLength={80} name="name" className={usersFieldClassName} placeholder="Example User" type="text" /></label>
        <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span><input required maxLength={160} name="email" className={usersFieldClassName} placeholder="user@example.com" type="email" /></label>
        <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">Role</span><select defaultValue={defaultRoleKey} name="roleKey" className={usersFieldClassName}>{roleOptions.map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}</select></label>
        <input defaultValue="true" name="isActive" type="hidden" />
        <div className={usersInsetSectionClassName}><input id="allow-login-create" className="ui-switch peer align-top" name="allowLogin" type="checkbox" value="true" /><label className="ml-3 inline-block cursor-pointer align-top" htmlFor="allow-login-create"><span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Allow login</span><span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">Add a temporary password for local sign-in, or leave it blank for Entra-only access when SSO is enabled.</span></label><div className="mt-4 hidden peer-checked:block"><label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">Temporary password</span><input minLength={8} maxLength={128} name="password" className={usersFieldClassName} placeholder="Only needed for local password sign-in" type="password" /></label><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">If Entra SSO is enabled, this user can still sign in without a local password. Their local role is the fallback when no Entra group mapping applies.</p></div></div>
        <div className={usersInsetSectionClassName}><div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">Departments</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select the departments this user should be mapped into.</p></div><div className="mt-4 space-y-2">{scopeOptions.length === 0 ? <p className="rounded-2xl border border-dashed border-[#ece7df] px-4 py-3 text-sm text-slate-500 dark:border-[#4b5255] dark:text-slate-400">No groups exist yet. Create departments first if this user should be scoped.</p> : scopeOptions.map((scope) => <label key={scope.id} className={usersScopeOptionClassName}><input className="ui-check" name="scopeIds" type="checkbox" value={scope.id} /><span className="flex-1">{scope.name}</span><span className="text-xs text-slate-500 dark:text-slate-400">{scope.slug}</span></label>)}</div></div>
        <Button className="w-full" type="submit">Create user</Button>
      </form>
    </PanelCard>
  );
}
