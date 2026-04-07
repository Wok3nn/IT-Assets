import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { clearUsersData } from "@/modules/settings/import-export.service";
import { readSetupState } from "@/services/setup-state";

export async function POST() {
  const [setupState, currentUser] = await Promise.all([readSetupState(), getCurrentUser()]);

  if (!setupState?.isCompleted) {
    return NextResponse.json({ error: "Setup is not complete." }, { status: 400 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await clearUsersData();
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear users." },
      { status: 400 },
    );
  }
}
