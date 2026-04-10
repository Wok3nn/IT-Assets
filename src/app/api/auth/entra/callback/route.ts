import { NextResponse } from "next/server";

import { getEntraAuthenticationConfig, isEntraAuthenticationConfigured } from "@/modules/settings/authentication-settings.service";
import { appConfig } from "@/services/config";
import { db } from "@/services/database";
import {
  ENTRA_AUTH_NONCE_COOKIE_NAME,
  ENTRA_AUTH_STATE_COOKIE_NAME,
  exchangeEntraAuthorizationCode,
  verifyEntraIdToken,
} from "@/services/entra-auth";
import { createSession, SESSION_COOKIE_NAME } from "@/services/session-store";
import { readSetupState } from "@/services/setup-state";
import { findUserByEmail } from "@/services/user-store";

function redirectToLogin(request: Request, reason: string) {
  return NextResponse.redirect(new URL(`/login?entraError=${encodeURIComponent(reason)}`, request.url));
}

function clearEntraCookies(response: NextResponse) {
  response.cookies.set({
    expires: new Date(0),
    name: ENTRA_AUTH_STATE_COOKIE_NAME,
    path: "/",
    value: "",
  });
  response.cookies.set({
    expires: new Date(0),
    name: ENTRA_AUTH_NONCE_COOKIE_NAME,
    path: "/",
    value: "",
  });
}

function getCookieValue(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function parseStateCookie(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(decodeURIComponent(value), "base64url").toString("utf8")) as {
      codeVerifier?: unknown;
      redirectUri?: unknown;
      state?: unknown;
    };

    if (
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.redirectUri !== "string" ||
      typeof parsed.state !== "string"
    ) {
      return null;
    }

    return {
      codeVerifier: parsed.codeVerifier,
      redirectUri: parsed.redirectUri,
      state: parsed.state,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    return redirectToLogin(request, error);
  }

  if (!code || !state) {
    return redirectToLogin(request, "missing-code");
  }

  const setupState = await readSetupState();

  if (!setupState?.isCompleted) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const stateCookie = parseStateCookie(getCookieValue(request, ENTRA_AUTH_STATE_COOKIE_NAME));
  const nonceCookie = getCookieValue(request, ENTRA_AUTH_NONCE_COOKIE_NAME);

  if (!stateCookie || stateCookie.state !== state || !nonceCookie) {
    return redirectToLogin(request, "invalid-state");
  }

  const config = await getEntraAuthenticationConfig();

  if (!isEntraAuthenticationConfigured(config)) {
    return redirectToLogin(request, "not-configured");
  }

  try {
    const idToken = await exchangeEntraAuthorizationCode({
      code,
      codeVerifier: stateCookie.codeVerifier,
      config,
      redirectUri: stateCookie.redirectUri,
    });
    const identity = await verifyEntraIdToken({
      config,
      idToken,
      nonce: decodeURIComponent(nonceCookie),
    });
    const user = await findUserByEmail(identity.email);

    if (!user || !user.isActive || !user.canLogin) {
      return redirectToLogin(request, "no-matching-user");
    }

    await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const session = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/dashboard", request.url));

    response.cookies.set({
      httpOnly: true,
      name: SESSION_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: appConfig.useSecureCookies,
      value: session.token,
    });
    clearEntraCookies(response);

    return response;
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "entra-sign-in-failed";

    return redirectToLogin(request, message);
  }
}
