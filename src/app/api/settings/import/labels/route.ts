import { NextResponse } from "next/server";

import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { importLabelTemplatesFromJson } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

export async function POST(request: Request) {
  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserSettingsPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    return NextResponse.json({ error: "Setup is not complete." }, { status: 400 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!permissionContext.canViewSettings || !permissionContext.capabilities.editLabels) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const summary = await importLabelTemplatesFromJson(await request.json());
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Label template import failed." },
      { status: 400 },
    );
  }
}
