import { NextResponse } from "next/server";
import { z } from "zod";

import { getBootstrapJsonResponse } from "@/lib/bootstrap.server";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { importScopesFromRows } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

const importSchema = z.object({
  columns: z.array(z.object({ header: z.string(), fieldId: z.string().nullable() })),
  rows: z.array(z.array(z.string())),
});

export async function POST(request: Request) {
  const bootstrapResponse = await getBootstrapJsonResponse();

  if (bootstrapResponse) {
    return bootstrapResponse;
  }

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

  if (!permissionContext.canViewSettings || !permissionContext.capabilities.editDepartments) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const parsed = importSchema.parse(await request.json());
    const summary = await importScopesFromRows({
      columns: parsed.columns,
      rows: parsed.rows,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Department import failed." },
      { status: 400 },
    );
  }
}
