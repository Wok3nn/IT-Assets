import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { UserEditCard } from "@/modules/users/components/user-edit-card";
import { getUserById, listAssignableRoles, listAssignableScopes, updateUser } from "@/modules/users/user.service";
import { normalizeUsersReturnTo } from "@/modules/users/users-routing";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type EditUserPageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams?: Promise<{
    returnTo?: string;
  }>;
};

async function updateUserAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }
  const permissionContext = await getCurrentUserPermissionContext();

  if (!permissionContext.capabilities.editUsers) {
    redirect("/users?view=users");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const returnTo = normalizeUsersReturnTo(String(formData.get("returnTo") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const allowLogin = String(formData.get("allowLogin") ?? "false") === "true";
  const password = String(formData.get("password") ?? "");
  const roleKey = String(formData.get("roleKey") ?? "").trim();
  const scopeIds = formData.getAll("scopeIds").map((value) => String(value).trim()).filter(Boolean);
  const isActive = String(formData.get("isActive") ?? "true") !== "false";

  if (!userId || name.length < 2 || email.length < 3 || !roleKey) {
    return;
  }

  await updateUser({
    userId,
    name,
    email,
    allowLogin,
    password,
    roleKey,
    scopeIds,
    isActive,
    actorUserId: currentUser.id,
  });

  revalidatePath("/users");
  redirect(returnTo);
}

export default async function EditUserPage({ params, searchParams }: EditUserPageProps) {
  const [{ userId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.capabilities.editUsers) {
    notFound();
  }

  const [user, roles, scopes] = await Promise.all([
    getUserById(userId),
    listAssignableRoles(),
    listAssignableScopes(),
  ]);

  if (!user) {
    notFound();
  }

  const returnTo = normalizeUsersReturnTo(resolvedSearchParams?.returnTo);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Users</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                Edit {user.name}
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
                Update this user on its own screen, then return to the same filtered directory view without reopening an inline panel.
              </p>
            </div>
            <Link href={returnTo}>
              <Button type="button" variant="ghost">
                Back to users
              </Button>
            </Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <UserEditCard
            action={updateUserAction}
            cancelHref={returnTo}
            editUser={user}
            returnTo={returnTo}
            roleOptions={roles}
            scopeOptions={scopes}
          />
        </div>
      </div>
    </AppShell>
  );
}
