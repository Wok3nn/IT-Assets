import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword } from "@/services/password";
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

  const existingSetup = await readSetupState();

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
        message: "Setup state is partially initialized. Remove the existing state files under /data/state and retry.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    redirectTo: "/login",
  });
}
