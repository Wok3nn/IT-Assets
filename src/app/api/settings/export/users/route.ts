import { NextResponse } from "next/server";

import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { exportUsersCsv } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

export async function GET() {
  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserSettingsPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    return NextResponse.redirect(new URL("/setup", process.env.APP_URL ?? "http://localhost:4050"));
  }

  if (!currentUser) {
    return NextResponse.redirect(new URL("/login", process.env.APP_URL ?? "http://localhost:4050"));
  }

  if (!permissionContext.canViewSettings || !permissionContext.capabilities.viewUsers) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const csv = await exportUsersCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="users-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}
