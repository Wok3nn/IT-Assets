import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/session";
import { importAssetsFromRows } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

const resolutionEntrySchema = z.object({
  sourceValue: z.string(),
  action: z.enum(["create", "map", "skip"]),
  targetValue: z.string().nullable().optional(),
});

const importSchema = z.object({
  columns: z.array(z.object({ header: z.string(), fieldId: z.string().nullable() })),
  rows: z.array(z.array(z.string())),
  resolutions: z
    .object({
      categories: z.array(resolutionEntrySchema).optional(),
      statuses: z.array(resolutionEntrySchema).optional(),
      scopes: z.array(resolutionEntrySchema).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const [setupState, currentUser] = await Promise.all([readSetupState(), getCurrentUser()]);

  if (!setupState?.isCompleted) {
    return NextResponse.json({ error: "Setup is not complete." }, { status: 400 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const parsed = importSchema.parse(await request.json());
    const summary = await importAssetsFromRows({
      columns: parsed.columns,
      rows: parsed.rows,
      actorUserId: currentUser.id,
      resolutions: parsed.resolutions,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Asset import failed." },
      { status: 400 },
    );
  }
}