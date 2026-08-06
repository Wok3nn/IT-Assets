import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { GuestProfileForm, type GuestProfileFormState } from "@/modules/users/components/guest-profile-form";
import { createGuestProfile } from "@/modules/users/guest-profile.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

const initialState: GuestProfileFormState = {
  values: {
    displayName: "",
    guestType: "Guest",
    notes: "",
  },
  error: null,
};

async function createGuestProfileAction(_state: GuestProfileFormState, formData: FormData): Promise<GuestProfileFormState> {
  "use server";

  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserPermissionContext();
  if (!permissionContext.capabilities.editUsers) redirect("/users/guests");

  const values = {
    displayName: String(formData.get("displayName") ?? "").trim(),
    guestType: String(formData.get("guestType") ?? "Guest").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  try {
    await createGuestProfile(values);
  } catch (error) {
    return {
      values,
      error: error instanceof Error ? error.message : "Guest Profile could not be created.",
    };
  }

  revalidatePath("/users/guests");
  redirect("/users/guests");
}

export default async function NewGuestProfilePage() {
  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
  ]);

  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!permissionContext.capabilities.editUsers) notFound();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Guest profiles</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">New Guest Profile</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Create an internal tracking record for an outside person. This does not create application access.</p>
            </div>
            <Link href="/users/guests"><Button type="button" variant="ghost">Back to Guest Profiles</Button></Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <GuestProfileForm action={createGuestProfileAction} initialState={initialState} submitLabel="Create Guest Profile" />
        </div>
      </div>
    </AppShell>
  );
}
