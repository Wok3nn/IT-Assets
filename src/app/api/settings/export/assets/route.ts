import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { exportAssetsCsv } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

export async function GET() {
  const [setupState, currentUser] = await Promise.all([readSetupState(), getCurrentUser()]);

  if (!setupState?.isCompleted) {
    return NextResponse.redirect(new URL("/setup", process.env.APP_URL ?? "http://localhost:4050"));
  }

  if (!currentUser) {
    return NextResponse.redirect(new URL("/login", process.env.APP_URL ?? "http://localhost:4050"));
  }

  const csv = await exportAssetsCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="assets-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}