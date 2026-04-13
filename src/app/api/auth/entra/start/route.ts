import { NextResponse } from "next/server";

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
import { readSetupState } from "@/services/setup-state";

function encodeStateCookie(input: {
  codeVerifier: string;
  redirectUri: string;
  state: string;
}) {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

export async function GET() {
  const setupState = await readSetupState();

  if (!setupState?.isCompleted) {
    return NextResponse.redirect(buildAppUrl("/setup"));
  }

  const config = await getEntraAuthenticationConfig();

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
