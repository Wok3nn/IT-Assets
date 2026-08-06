import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { GuestProfileForm, type GuestProfileFormState } from "@/modules/users/components/guest-profile-form";
import { getGuestProfileById, updateGuestProfile } from "@/modules/users/guest-profile.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type EditGuestProfilePageProps = {
  params: Promise<{ guestId: string }>;
};

async function updateGuestProfileAction(
  guestProfileId: string,
  _state: GuestProfileFormState,
  formData: FormData,
): Promise<GuestProfileFormState> {
  "use server";

  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserPermissionContext();
  if (!permissionContext.capabilities.editUsers) redirect(`/users/guests/${guestProfileId}`);

  const values = {
    displayName: String(formData.get("displayName") ?? "").trim(),
    guestType: String(formData.get("guestType") ?? "Guest").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  try {
    await updateGuestProfile({ guestProfileId, ...values });
  } catch (error) {
    return {
      values,
      error: error instanceof Error ? error.message : "Guest Profile could not be updated.",
    };
  }

  revalidatePath("/users/guests");
  revalidatePath(`/users/guests/${guestProfileId}`);
  redirect(`/users/guests/${guestProfileId}`);
}

export default async function EditGuestProfilePage({ params }: EditGuestProfilePageProps) {
  const { guestId } = await params;
  const [setupState, currentUser, permissionContext, guestProfile] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
    getGuestProfileById(guestId),
  ]);

  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!permissionContext.capabilities.editUsers) notFound();
  if (!guestProfile) notFound();

  const initialState: GuestProfileFormState = {
    values: {
      displayName: guestProfile.displayName,
      guestType: guestProfile.guestType,
      notes: guestProfile.notes ?? "",
    },
    error: null,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Guest profiles</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Edit Guest Profile</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">Update the internal tracking details for this outside person.</p>
            </div>
            <Link href={`/users/guests/${guestProfile.id}`}><Button type="button" variant="ghost">Back to Guest Profile</Button></Link>
          </div>
        </PageHero>

        <div className="mx-auto w-full max-w-3xl">
          <GuestProfileForm action={updateGuestProfileAction.bind(null, guestProfile.id)} initialState={initialState} submitLabel="Save Guest Profile" />
        </div>
      </div>
    </AppShell>
  );
}
