import { NextResponse } from "next/server";

import { getBootstrapFailurePath, getBootstrapRedirectResponse } from "@/lib/bootstrap.server";
import {
  getEntraAuthenticationConfig,
  isEntraAuthenticationConfigured,
} from "@/modules/settings/authentication-settings.service";
import { appConfig, buildAppUrl } from "@/services/config";
import {
  createEntraAuthRequest,
  ENTRA_AUTH_NONCE_COOKIE_NAME,
  ENTRA_AUTH_STATE_COOKIE_NAME,
} from "@/services/entra-auth";
import { logger } from "@/services/logger";
import { readSetupState } from "@/services/setup-state";

function encodeStateCookie(input: {
  codeVerifier: string;
  redirectUri: string;
  state: string;
}) {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

export async function GET() {
  const bootstrapResponse = await getBootstrapRedirectResponse();

  if (bootstrapResponse) {
    return bootstrapResponse;
  }

  let setupState: Awaited<ReturnType<typeof readSetupState>>;

  try {
    setupState = await readSetupState();
  } catch (error) {
    logger.warn("[bootstrap] Failed to read setup state during Entra start.", error);
    const fallbackPath = getBootstrapFailurePath();
    logger.info(`Routing to ${fallbackPath}`);
    return NextResponse.redirect(buildAppUrl(fallbackPath));
  }

  if (!setupState?.isCompleted) {
    return NextResponse.redirect(buildAppUrl("/setup"));
  }

  let config: Awaited<ReturnType<typeof getEntraAuthenticationConfig>>;

  try {
    config = await getEntraAuthenticationConfig();
  } catch (error) {
    logger.warn("[bootstrap] Failed to load Entra configuration.", error);
    const fallbackPath = getBootstrapFailurePath();
    logger.info(`Routing to ${fallbackPath}`);
    return NextResponse.redirect(buildAppUrl(fallbackPath));
  }

  if (!isEntraAuthenticationConfigured(config)) {
    return NextResponse.redirect(buildAppUrl("/login?entraError=not-configured"));
  }

  const authRequest = createEntraAuthRequest({
    config,
    origin: appConfig.appUrl,
  });
  const response = NextResponse.redirect(authRequest.authUrl);

  response.cookies.set({
    httpOnly: true,
    maxAge: 60 * 10,
    name: ENTRA_AUTH_STATE_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: appConfig.useSecureCookies,
    value: encodeStateCookie({
      codeVerifier: authRequest.codeVerifier,
      redirectUri: authRequest.redirectUri,
      state: authRequest.state,
    }),
  });
  response.cookies.set({
    httpOnly: true,
    maxAge: 60 * 10,
    name: ENTRA_AUTH_NONCE_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: appConfig.useSecureCookies,
    value: authRequest.nonce,
  });

  return response;
}
