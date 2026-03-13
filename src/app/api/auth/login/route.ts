import { NextResponse } from "next/server";
import { z } from "zod";

import { createSession, SESSION_COOKIE_NAME } from "@/services/session-store";
import { verifyPassword } from "@/services/password";
import { readSetupState } from "@/services/setup-state";
import { findUserByEmail } from "@/services/user-store";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(request: Request) {
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

  const setupState = await readSetupState();

  if (!setupState?.isCompleted) {
    return NextResponse.json(
      {
        ok: false,
        message: "Setup is not complete yet.",
      },
      { status: 409 },
    );
  }

  const user = await findUserByEmail(parsed.data.email.toLowerCase());

  if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid email or password.",
      },
      { status: 401 },
    );
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({ ok: true, redirectTo: "/dashboard" });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });

  return response;
}
