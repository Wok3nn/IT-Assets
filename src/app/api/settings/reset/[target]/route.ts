import { NextResponse } from "next/server";

import { canManageSettings } from "@/lib/permissions";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser, getCurrentUserRoleKeys } from "@/lib/session.server";
import { RESET_ACTIONS, type ResetActionKey, runResetAction } from "@/modules/settings/reset-management.service";
import { readSetupState } from "@/services/setup-state";

export async function POST(
  _request: Request,
  context: { params: Promise<{ target: string }> },
) {
  const { target } = await context.params;
  const [setupState, currentUser, roleKeys, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserRoleKeys(),
    getCurrentUserSettingsPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    return NextResponse.json({ error: "Setup is not complete." }, { status: 400 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!permissionContext.canViewSettings || !canManageSettings(roleKeys)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!RESET_ACTIONS.includes(target as ResetActionKey)) {
    return NextResponse.json({ error: "Unknown reset action." }, { status: 404 });
  }

  try {
    const result = await runResetAction(target as ResetActionKey);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete reset." },
      { status: 400 },
    );
  }
}
