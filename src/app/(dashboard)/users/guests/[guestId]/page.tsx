import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { PanelCard } from "@/components/layout/panel-card";
import { AppShell } from "@/components/navigation/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUserAssetPermissionContext, getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { AssetStatusPill } from "@/modules/assets/asset-status-pill";
import { buildAssetHref } from "@/modules/assets/assets-routing";
import { checkOutAsset, getAssetById, listAssetsAssignedToGuestProfile, listAvailableAssetsForAssignment } from "@/modules/assets/asset.service";
import { UserAssignAssetDialog, type UserAssignAssetState } from "@/modules/users/components/user-assign-asset-dialog";
import { archiveGuestProfile, getGuestProfileById, restoreGuestProfile } from "@/modules/users/guest-profile.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type GuestProfileDetailPageProps = {
  params: Promise<{ guestId: string }>;
  searchParams?: Promise<{ error?: string; restored?: string; archived?: string }>;
};

function formatDateTimeLabel(value?: Date | null) {
  return value ? value.toLocaleString() : "Not recorded";
}

async function assignAssetToGuestProfileAction(
  guestProfileId: string,
  _state: UserAssignAssetState,
  formData: FormData,
): Promise<UserAssignAssetState> {
  "use server";

  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.viewUsers || !permissionContext.capabilities.manageAssetTransfers) {
    return { ok: false, message: "You do not have permission to assign assets." };
  }

  const guestProfile = await getGuestProfileById(guestProfileId);
  if (!guestProfile || !guestProfile.isActive) {
    return { ok: false, message: "Guest Profile is no longer available for assignment." };
  }

  const assetId = String(formData.get("assetId") ?? "").trim();
  const notes = String(formData.get("transferNote") ?? "");

  if (!assetId) {
    return { ok: false, message: "Choose an available asset before assigning." };
  }

  const asset = await getAssetById(assetId, { accessScope: permissionContext.assetScope });
  if (!asset || asset.assignedUserId || asset.assignedGuestProfileId || asset.status?.key !== "IN_STOCK") {
    return { ok: false, message: "This asset is no longer available." };
  }

  try {
    await checkOutAsset({
      assetId,
      assignee: { type: "guest-profile", id: guestProfile.id },
      notes,
      actorUserId: currentUser.id,
      accessScope: permissionContext.assetScope,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Asset could not be assigned.",
    };
  }

  revalidatePath(`/users/guests/${guestProfile.id}`);
  revalidatePath("/users/guests");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/assets/${assetId}/history`);

  return { ok: true, message: "Asset assigned." };
}

async function archiveGuestProfileAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserPermissionContext();
  if (!permissionContext.capabilities.editUsers) redirect("/users/guests");

  const guestProfileId = String(formData.get("guestProfileId") ?? "").trim();

  try {
    await archiveGuestProfile(guestProfileId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Guest Profile could not be archived.";
    redirect(`/users/guests/${guestProfileId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/users/guests");
  revalidatePath(`/users/guests/${guestProfileId}`);
  redirect(`/users/guests/${guestProfileId}?archived=true`);
}

async function restoreGuestProfileAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const permissionContext = await getCurrentUserPermissionContext();
  if (!permissionContext.capabilities.editUsers) redirect("/users/guests");

  const guestProfileId = String(formData.get("guestProfileId") ?? "").trim();
  await restoreGuestProfile(guestProfileId);

  revalidatePath("/users/guests");
  revalidatePath(`/users/guests/${guestProfileId}`);
  redirect(`/users/guests/${guestProfileId}?restored=true`);
}

export default async function GuestProfileDetailPage({ params, searchParams }: GuestProfileDetailPageProps) {
  const [{ guestId }, search] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const [setupState, currentUser, userPermissionContext, assetPermissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserPermissionContext(),
    getCurrentUserAssetPermissionContext(),
  ]);

  if (!setupState?.isCompleted) redirect("/setup");
  if (!currentUser) redirect("/login");
  if (!userPermissionContext.capabilities.viewUsers) notFound();

  const canManageGuestProfiles = userPermissionContext.capabilities.editUsers;
  const canAssignAssets = assetPermissionContext.capabilities.manageAssetTransfers;
  const [guestProfile, assignedAssets, availableAssets] = await Promise.all([
    getGuestProfileById(guestId),
    assetPermissionContext.capabilities.viewAssets || canAssignAssets
      ? listAssetsAssignedToGuestProfile(guestId, { accessScope: assetPermissionContext.assetScope })
      : Promise.resolve([]),
    canAssignAssets ? listAvailableAssetsForAssignment({ accessScope: assetPermissionContext.assetScope }) : Promise.resolve([]),
  ]);

  if (!guestProfile) notFound();

  const feedback = search?.error
    ? { tone: "error" as const, message: search.error }
    : search?.archived === "true"
      ? { tone: "success" as const, message: "Guest Profile archived." }
      : search?.restored === "true"
        ? { tone: "success" as const, message: "Guest Profile restored." }
        : null;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Guest profile</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{guestProfile.displayName}</h1>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{guestProfile.guestType} · Internal tracking only, no application access.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {canAssignAssets && guestProfile.isActive ? (
                <UserAssignAssetDialog
                  action={assignAssetToGuestProfileAction.bind(null, guestProfile.id)}
                  assets={availableAssets}
                  recipient={{ label: guestProfile.displayName, description: `Guest profile · ${guestProfile.guestType}` }}
                />
              ) : null}
              {canManageGuestProfiles ? <Link href={`/users/guests/${guestProfile.id}/edit`}><Button type="button" variant="secondary">Edit Guest Profile</Button></Link> : null}
              <Link href="/users/guests"><Button type="button" variant="ghost">Back to Guest Profiles</Button></Link>
            </div>
          </div>
        </PageHero>

        {feedback ? (
          <div className={feedback.tone === "success" ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"}>
            {feedback.message}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <PanelCard className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Guest profile</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">Tracking details</h2>
              </div>
              <span className={guestProfile.isActive ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"}>
                {guestProfile.isActive ? "Active" : "Archived"}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#34393c]"><p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Type</p><p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{guestProfile.guestType}</p></div>
              <div className="rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#34393c]"><p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Assigned assets</p><p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{guestProfile._count.assignedAssets}</p></div>
              <div className="rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 dark:border-[#4b5255] dark:bg-[#34393c]"><p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Created</p><p className="mt-2 text-sm font-medium text-slate-950 dark:text-slate-100">{formatDateTimeLabel(guestProfile.createdAt)}</p></div>
            </div>
            {guestProfile.notes ? <div className="mt-5 rounded-3xl border border-[#ece7df] bg-[#f8f9fb] p-4 text-sm text-slate-700 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-200">{guestProfile.notes}</div> : null}
            {canManageGuestProfiles ? (
              <div className="mt-5">
                {guestProfile.isActive ? (
                  <form action={archiveGuestProfileAction}>
                    <input name="guestProfileId" type="hidden" value={guestProfile.id} />
                    <Button type="submit" variant="secondary">Archive Guest Profile</Button>
                  </form>
                ) : (
                  <form action={restoreGuestProfileAction}>
                    <input name="guestProfileId" type="hidden" value={guestProfile.id} />
                    <Button type="submit" variant="secondary">Restore Guest Profile</Button>
                  </form>
                )}
              </div>
            ) : null}
          </PanelCard>

          <PanelCard className="p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Assigned assets</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">Current assignments</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{assignedAssets.length} asset{assignedAssets.length === 1 ? "" : "s"} visible for this Guest Profile.</p>
            </div>
            {assignedAssets.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-dashed border-[#ece7df] bg-[#f8f9fb] px-5 py-8 text-center text-sm text-slate-500 dark:border-[#4b5255] dark:bg-[#34393c] dark:text-slate-400">No assets are currently assigned to this Guest Profile.</div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-[28px] border border-[#ece7df] dark:border-[#4b5255]">
                <table className="min-w-[680px] w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                  <thead className="bg-[#f8f9fb] dark:bg-[#34393c]"><tr><th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Asset</th><th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Status</th><th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Location</th></tr></thead>
                  <tbody className="divide-y divide-slate-200 bg-white/96 dark:divide-slate-800 dark:bg-[#34393c]">
                    {assignedAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="px-4 py-3"><Link className="font-semibold text-[#b56613] underline-offset-4 transition hover:underline dark:text-[#ffd7ab]" href={buildAssetHref(asset.id)}>{asset.assetTag}</Link><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{asset.model?.trim() || asset.name}</p></td>
                        <td className="px-3 py-3">{asset.status ? <AssetStatusPill color={asset.status.color} label={asset.status.name} /> : <span className="text-slate-500 dark:text-slate-400">No status</span>}</td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{asset.assignedLocation?.name ?? "Unassigned"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
