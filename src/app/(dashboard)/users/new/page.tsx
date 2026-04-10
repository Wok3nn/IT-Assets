import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { UserCreateCard } from "@/modules/users/components/user-create-card";
import { createUser, listAssignableRoles, listAssignableScopes } from "@/modules/users/user.service";
import { readSetupState } from "@/services/setup-state";

const USERS_DIRECTORY_HREF = "/users?view=users";

async function createUserAction(formData: FormData) {
  "use server";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserPermissionContext();
  if (!permissionContext.capabilities.editUsers) redirect(USERS_DIRECTORY_HREF);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const allowLogin = String(formData.get("allowLogin") ?? "false") === "true";
  const password = String(formData.get("password") ?? "");
  const roleKey = String(formData.get("roleKey") ?? "").trim();
  const scopeIds = formData.getAll("scopeIds").map((value) => String(value).trim()).filter(Boolean);
  const isActive = String(formData.get("isActive") ?? "true") !== "false";
  if (name.length < 2 || email.length < 3 || !roleKey) return;
  await createUser({ name, email, allowLogin, password, roleKey, scopeIds, isActive });
  revalidatePath("/users");
  redirect(USERS_DIRECTORY_HREF);
}

export default async function NewUserPage() {
  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
  ]);

  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!permissionContext.capabilities.editUsers) notFound();

  const [roles, scopes] = await Promise.all([
    listAssignableRoles(),
    listAssignableScopes(),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Users</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">New user</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Create a user in its own dedicated flow so directory browsing and user setup stay focused and easier to manage.</p>
            </div>
            <Link href={USERS_DIRECTORY_HREF}><Button type="button" variant="ghost">Back to users</Button></Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <UserCreateCard action={createUserAction} defaultRoleKey={roles[0]?.key ?? ""} roleOptions={roles} scopeOptions={scopes} />
        </div>
      </div>
    </AppShell>
  );
}
