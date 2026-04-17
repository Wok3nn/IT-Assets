import { NextResponse } from "next/server";
import { z } from "zod";

import { getBootstrapJsonResponse } from "@/lib/bootstrap.server";
import { db } from "@/services/database";
import { appConfig } from "@/services/config";
import { logger } from "@/services/logger";
import { hasLocalPasswordConfigured } from "@/services/password";
import { createSession, SESSION_COOKIE_NAME, SESSION_EFFECTIVE_ROLES_COOKIE_NAME } from "@/services/session-store";
import { verifyPassword } from "@/services/password";
import { readSetupState } from "@/services/setup-state";
import { findUserByEmail } from "@/services/user-store";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(request: Request) {
  const bootstrapResponse = await getBootstrapJsonResponse(
    "Database setup is required before sign-in is available.",
    409,
  );

  if (bootstrapResponse) {
    return bootstrapResponse;
  }

  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  let setupState: Awaited<ReturnType<typeof readSetupState>>;

  try {
    setupState = await readSetupState();
  } catch (error) {
    logger.warn("[bootstrap] Failed to read setup state during local sign-in.", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Database setup is required before sign-in is available.",
      },
      { status: 503 },
    );
  }

  if (!setupState?.isCompleted) {
    return NextResponse.json(
      {
        ok: false,
        message: "Setup is not complete yet.",
      },
      { status: 409 },
    );
  }

  let user: Awaited<ReturnType<typeof findUserByEmail>>;

  try {
    user = await findUserByEmail(parsed.data.email.toLowerCase());
  } catch (error) {
    logger.warn("[bootstrap] Failed to load user during local sign-in.", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Database setup is required before sign-in is available.",
      },
      { status: 503 },
    );
  }

  if (
    !user ||
    !user.isActive ||
    !user.canLogin ||
    !hasLocalPasswordConfigured(user.passwordHash) ||
    !verifyPassword(parsed.data.password, user.passwordHash)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid email or password.",
      },
      { status: 401 },
    );
  }

  let session: Awaited<ReturnType<typeof createSession>>;

  try {
    await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    session = await createSession(user.id);
  } catch (error) {
    logger.warn("[bootstrap] Failed to finalize local sign-in.", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Database setup is required before sign-in is available.",
      },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true, redirectTo: "/dashboard" });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    sameSite: "lax",
    secure: appConfig.useSecureCookies,
    path: "/",
  });
  response.cookies.set({
    name: SESSION_EFFECTIVE_ROLES_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: appConfig.useSecureCookies,
    path: "/",
    expires: new Date(0),
  });

  return response;
}

