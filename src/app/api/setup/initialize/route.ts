import { NextResponse } from "next/server";
import { z } from "zod";

import { getBootstrapJsonResponse } from "@/lib/bootstrap.server";
import { hashPassword } from "@/services/password";
import { logger } from "@/services/logger";
import { readSetupState, writeSetupState } from "@/services/setup-state";
import { createInitialAdmin } from "@/services/user-store";

const setupSchema = z
  .object({
    siteName: z.string().trim().min(2, "Enter the organization or site name used in the app branding."),
    adminEmail: z.string().trim().email("Enter a valid admin email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm the password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  if (process.env.IT_ASSETS_MANAGED === "1") return NextResponse.json({ error: "Use Database Management." }, { status: 403 });
  const bootstrapResponse = await getBootstrapJsonResponse(
    "Database setup is required before workspace initialization can continue.",
    409,
  );

  if (bootstrapResponse) {
    return bootstrapResponse;
  }

  const body = await request.json();
  const parsed = setupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  let existingSetup: Awaited<ReturnType<typeof readSetupState>>;

  try {
    existingSetup = await readSetupState();
  } catch (error) {
    logger.warn("[bootstrap] Failed to read setup state during workspace initialization.", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Database setup is required before workspace initialization can continue.",
      },
      { status: 503 },
    );
  }

  if (existingSetup?.isCompleted) {
    return NextResponse.json(
      {
        ok: false,
        message: "Workspace setup has already been completed.",
      },
      { status: 409 },
    );
  }

  try {
    await createInitialAdmin({
      email: parsed.data.adminEmail.trim().toLowerCase(),
      displayName: "Initial Administrator",
      passwordHash: hashPassword(parsed.data.password),
    });

    await writeSetupState({
      isCompleted: true,
      siteName: parsed.data.siteName.trim(),
      initializedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Setup could not be completed because database state already exists. Clear the local database and retry.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    redirectTo: "/login",
  });
}
