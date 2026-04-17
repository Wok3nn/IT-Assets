import { NextResponse } from "next/server";

import { getBootstrapRedirectResponse } from "@/lib/bootstrap.server";
import {
  getEntraAuthenticationConfig,
  getAuthenticationSettings,
  isEntraAuthenticationConfigured,
  resolveEntraMappedRoleKeys,
} from "@/modules/settings/authentication-settings.service";
import { appConfig, buildAppUrl } from "@/services/config";
import { db } from "@/services/database";
import {
  ENTRA_AUTH_NONCE_COOKIE_NAME,
  ENTRA_AUTH_STATE_COOKIE_NAME,
  exchangeEntraAuthorizationCode,
  listEntraUserTransitiveGroupIds,
  verifyEntraIdToken,
} from "@/services/entra-auth";
import {
  createEffectiveRoleCookieValue,
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_EFFECTIVE_ROLES_COOKIE_NAME,
} from "@/services/session-store";
import { logger } from "@/services/logger";
import { readSetupState } from "@/services/setup-state";
import { findUserByEmail } from "@/services/user-store";

function redirectToLogin(request: Request, reason: string) {
  return NextResponse.redirect(buildAppUrl(`/login?entraError=${encodeURIComponent(reason)}`));
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

function normalizeGroupId(groupId: string) {
  return groupId.trim().toLowerCase();
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

  const bootstrapResponse = await getBootstrapRedirectResponse();

  if (bootstrapResponse) {
    return bootstrapResponse;
  }

  let setupState: Awaited<ReturnType<typeof readSetupState>>;

  try {
    setupState = await readSetupState();
  } catch (error) {
    logger.warn("[bootstrap] Failed to read setup state during Entra callback.", error);
    logger.info("Routing to DB setup");
    return NextResponse.redirect(buildAppUrl("/setup/db"));
  }

  if (!setupState?.isCompleted) {
    return NextResponse.redirect(buildAppUrl("/setup"));
  }

  const stateCookie = parseStateCookie(getCookieValue(request, ENTRA_AUTH_STATE_COOKIE_NAME));
  const nonceCookie = getCookieValue(request, ENTRA_AUTH_NONCE_COOKIE_NAME);

  if (!stateCookie || stateCookie.state !== state || !nonceCookie) {
    return redirectToLogin(request, "invalid-state");
  }

  let config: Awaited<ReturnType<typeof getEntraAuthenticationConfig>>;

  try {
    config = await getEntraAuthenticationConfig();
  } catch (error) {
    logger.warn("[bootstrap] Failed to load Entra configuration during callback.", error);
    logger.info("Routing to DB setup");
    return NextResponse.redirect(buildAppUrl("/setup/db"));
  }

  if (!isEntraAuthenticationConfigured(config)) {
    return redirectToLogin(request, "not-configured");
  }

  try {
    const { accessToken, idToken } = await exchangeEntraAuthorizationCode({
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

    const shouldUseGraphFallback = identity.groupIds.length === 0 || identity.hasGroupsOverage;
    const groupIds = shouldUseGraphFallback
      ? await listEntraUserTransitiveGroupIds(accessToken)
      : identity.groupIds;
    const effectiveRoleKeys = await resolveEntraMappedRoleKeys(groupIds);
    const authenticationSettings = await getAuthenticationSettings();
    const normalizedGroupIds = new Set(groupIds.map(normalizeGroupId).filter(Boolean));
    const matchedMappingGroups = authenticationSettings.groupMappings
      .filter((mapping) => normalizedGroupIds.has(normalizeGroupId(mapping.groupId)))
      .map((mapping) => ({
        groupId: mapping.groupId,
        roleKey: mapping.roleKey,
      }));

    console.info("[entra-auth] resolved effective roles", {
      email: identity.email,
      graphFallbackUsed: shouldUseGraphFallback,
      matchedMappingGroups,
      resolvedRoleKeys: effectiveRoleKeys,
    });

    await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const session = await createSession(user.id);
    const response = NextResponse.redirect(buildAppUrl("/dashboard"));

    response.cookies.set({
      httpOnly: true,
      name: SESSION_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: appConfig.useSecureCookies,
      value: session.token,
    });
    response.cookies.set({
      httpOnly: true,
      name: SESSION_EFFECTIVE_ROLES_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: appConfig.useSecureCookies,
      value: createEffectiveRoleCookieValue(session.token, effectiveRoleKeys) ?? "",
      ...(effectiveRoleKeys.length === 0 ? { expires: new Date(0) } : {}),
    });
    clearEntraCookies(response);

    return response;
  } catch (caughtError) {
    logger.warn("[bootstrap] Entra callback failed.", caughtError);
    const message = caughtError instanceof Error ? caughtError.message : "entra-sign-in-failed";

    return redirectToLogin(request, message);
  }
}
