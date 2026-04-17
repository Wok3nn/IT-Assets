import { NextResponse } from "next/server";

import { getBootstrapRedirectResponse } from "@/lib/bootstrap.server";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { buildExportFileResponse, exportData } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

export async function GET() {
  const bootstrapResponse = await getBootstrapRedirectResponse();

  if (bootstrapResponse) {
    return bootstrapResponse;
  }

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

  if (!permissionContext.canViewSettings || !permissionContext.capabilities.viewLabels) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const responseFile = buildExportFileResponse(await exportData("labels", "json"));
  return new NextResponse(responseFile.body, {
    headers: {
      "Content-Type": responseFile.contentType,
      "Content-Disposition": `attachment; filename="${responseFile.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
