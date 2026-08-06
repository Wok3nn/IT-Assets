import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUserAssetPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { checkOutAsset, getAssetById, listAssetsAssignedToUser, listAvailableAssetsForAssignment, unassignAssetFromUser } from "@/modules/assets/asset.service";
import { UserDetailPanel } from "@/modules/users/components/user-detail-panel";
import type { UserAssignAssetState } from "@/modules/users/components/user-assign-asset-dialog";
import { getUserById } from "@/modules/users/user.service";
import { buildUserHref, USERS_DIRECTORY_HREF } from "@/modules/users/users-routing";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

type UserDetailPageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams?: Promise<{
    unassigned?: string;
    error?: string;
  }>;
};

function canUnassignUserAssets(capabilities: Awaited<ReturnType<typeof getCurrentUserAssetPermissionContext>>["capabilities"]) {
  return capabilities.editAssets || capabilities.editUsers || capabilities.manageAssetTransfers;
}

function canAssignUserAssets(capabilities: Awaited<ReturnType<typeof getCurrentUserAssetPermissionContext>>["capabilities"]) {
  return capabilities.manageAssetTransfers;
}

function buildFeedback(searchParams?: { unassigned?: string; error?: string }) {
  if (searchParams?.unassigned === "true") {
    return {
      message: "Asset assignment removed.",
      tone: "success" as const,
    };
  }

  if (searchParams?.error) {
    return {
      message: searchParams.error,
      tone: "error" as const,
    };
  }

  return null;
}

async function unassignUserAssetAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.viewUsers || !canUnassignUserAssets(permissionContext.capabilities)) {
    redirect(USERS_DIRECTORY_HREF);
  }

  const assetId = String(formData.get("assetId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const detailHref = buildUserHref(userId);

  try {
    await unassignAssetFromUser({
      assetId,
      userId,
      actorUserId: currentUser.id,
      accessScope: permissionContext.assetScope,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset could not be unassigned.";
    redirect(`${detailHref}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(detailHref);
  revalidatePath("/assets");
  redirect(`${detailHref}?unassigned=true`);
}

async function assignAssetToUserAction(
  targetUserId: string,
  _state: UserAssignAssetState,
  formData: FormData,
): Promise<UserAssignAssetState> {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserAssetPermissionContext();

  if (!permissionContext.capabilities.viewUsers || !canAssignUserAssets(permissionContext.capabilities)) {
    return {
      ok: false,
      message: "You do not have permission to assign assets.",
    };
  }

  const targetUser = await getUserById(targetUserId);

  if (!targetUser) {
    return {
      ok: false,
      message: "User was not found.",
    };
  }

  const assetId = String(formData.get("assetId") ?? "").trim();
  const notes = String(formData.get("transferNote") ?? "");

  if (!assetId) {
    return {
      ok: false,
      message: "Choose an available asset before assigning.",
    };
  }

  const asset = await getAssetById(assetId, { accessScope: permissionContext.assetScope });

  if (!asset) {
    return {
      ok: false,
      message: "Asset was not found or is no longer available.",
    };
  }

  if (asset.assignedUserId || asset.assignedGuestProfileId || asset.status?.key !== "IN_STOCK") {
    return {
      ok: false,
      message: "This asset is no longer available.",
    };
  }

  try {
    await checkOutAsset({
      assetId,
      assignee: { type: "organization-user", id: targetUser.id },
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

  const detailHref = buildUserHref(targetUser.id);
  revalidatePath(detailHref);
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/assets/${assetId}/history`);

  return {
    ok: true,
    message: "Asset assigned.",
  };
}

export default async function UserDetailPage({ params, searchParams }: UserDetailPageProps) {
  const [{ userId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserAssetPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.capabilities.viewUsers) {
    notFound();
  }

  const canUnassignAssets = canUnassignUserAssets(permissionContext.capabilities);
  const canAssignAssets = canAssignUserAssets(permissionContext.capabilities);
  const canViewAssignedAssets = permissionContext.capabilities.viewAssets || canUnassignAssets;
  const [user, assignedAssets, availableAssets] = await Promise.all([
    getUserById(userId),
    canViewAssignedAssets
      ? listAssetsAssignedToUser(userId, { accessScope: permissionContext.assetScope })
      : Promise.resolve([]),
    canAssignAssets
      ? listAvailableAssetsForAssignment({ accessScope: permissionContext.assetScope })
      : Promise.resolve([]),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <AppShell>
      <UserDetailPanel
        assignedAssets={assignedAssets}
        assignAssetAction={assignAssetToUserAction.bind(null, user.id)}
        availableAssets={availableAssets}
        canAssignAssets={canAssignAssets}
        canEditUser={permissionContext.capabilities.editUsers}
        canUnassignAssets={canUnassignAssets}
        canViewAssets={canViewAssignedAssets}
        feedback={buildFeedback(resolvedSearchParams)}
        unassignAction={unassignUserAssetAction}
        user={user}
      />
    </AppShell>
  );
}
