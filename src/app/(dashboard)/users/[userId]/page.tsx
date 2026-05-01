import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUserAssetPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { listAssetsAssignedToUser, unassignAssetFromUser } from "@/modules/assets/asset.service";
import { UserDetailPanel } from "@/modules/users/components/user-detail-panel";
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
  const canViewAssignedAssets = permissionContext.capabilities.viewAssets || canUnassignAssets;
  const [user, assignedAssets] = await Promise.all([
    getUserById(userId),
    canViewAssignedAssets
      ? listAssetsAssignedToUser(userId, { accessScope: permissionContext.assetScope })
      : Promise.resolve([]),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <AppShell>
      <UserDetailPanel
        assignedAssets={assignedAssets}
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
