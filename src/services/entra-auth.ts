import { createHash, randomBytes, randomUUID, verify, type JsonWebKey as NodeJsonWebKey } from "node:crypto";

import type { EntraAuthenticationConfig } from "@/modules/settings/authentication-settings.service";

export const ENTRA_AUTH_STATE_COOKIE_NAME = "it_asset_tracker_entra_state";
export const ENTRA_AUTH_NONCE_COOKIE_NAME = "it_asset_tracker_entra_nonce";

const ENTRA_SCOPES = ["openid", "profile", "email"];
const ENTRA_AUTHORITY_BASE_URL = "https://login.microsoftonline.com";

type EntraTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

type EntraIdTokenClaims = {
  aud?: string;
  email?: string;
  exp?: number;
  groups?: string[];
  hasgroups?: boolean;
  iss?: string;
  name?: string;
  nonce?: string;
  preferred_username?: string;
  tid?: string;
  upn?: string;
};

type EntraJsonWebKey = NodeJsonWebKey & {
  kid?: string;
};

type JsonWebKeySet = {
  keys?: EntraJsonWebKey[];
};

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4 || 4)), "=");

  return Buffer.from(padded, "base64");
}

function parseJwtSegment<TValue>(input: string) {
  return JSON.parse(base64UrlDecode(input).toString("utf8")) as TValue;
}

function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function getTenantAuthority(tenantId: string) {
  return `${ENTRA_AUTHORITY_BASE_URL}/${encodeURIComponent(tenantId)}/oauth2/v2.0`;
}

export function createEntraAuthRequest(input: {
  config: EntraAuthenticationConfig;
  origin: string;
}) {
  const redirectUri = input.config.configuredRedirectUri || `${input.origin}/api/auth/entra/callback`;
  const state = randomUUID();
  const nonce = randomUUID();
  const codeVerifier = randomBytes(48).toString("base64url");
  const authUrl = new URL(`${getTenantAuthority(input.config.tenantId)}/authorize`);

  authUrl.searchParams.set("client_id", input.config.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", ENTRA_SCOPES.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", createCodeChallenge(codeVerifier));
  authUrl.searchParams.set("code_challenge_method", "S256");

  return {
    authUrl,
    codeVerifier,
    nonce,
    redirectUri,
    state,
  };
}

export async function exchangeEntraAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  config: EntraAuthenticationConfig;
  redirectUri: string;
}) {
  const tokenUrl = `${getTenantAuthority(input.config.tenantId)}/token`;
  const body = new URLSearchParams({
    client_id: input.config.clientId,
    client_secret: input.config.clientSecret,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    scope: ENTRA_SCOPES.join(" "),
  });
  const response = await fetch(tokenUrl, {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const payload = await response.json() as EntraTokenResponse;

  if (!response.ok || !payload.id_token) {
    throw new Error(payload.error_description || payload.error || "Microsoft Entra token exchange failed.");
  }

  return payload.id_token;
}

export async function verifyEntraIdToken(input: {
  config: EntraAuthenticationConfig;
  idToken: string;
  nonce: string;
}) {
  const segments = input.idToken.split(".");

  if (segments.length !== 3) {
    throw new Error("Microsoft Entra returned an invalid identity token.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = parseJwtSegment<{ alg?: string; kid?: string }>(encodedHeader);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Microsoft Entra identity token uses an unsupported signature.");
  }

  const jwksResponse = await fetch(`${ENTRA_AUTHORITY_BASE_URL}/${encodeURIComponent(input.config.tenantId)}/discovery/v2.0/keys`);
  const jwks = await jwksResponse.json() as JsonWebKeySet;
  const signingKey = jwks.keys?.find((key) => key.kid === header.kid);

  if (!jwksResponse.ok || !signingKey) {
    throw new Error("Microsoft Entra signing key could not be resolved.");
  }

  const isValidSignature = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    { key: signingKey, format: "jwk" },
    base64UrlDecode(encodedSignature),
  );

  if (!isValidSignature) {
    throw new Error("Microsoft Entra identity token signature could not be verified.");
  }

  const claims = parseJwtSegment<EntraIdTokenClaims>(encodedPayload);
  const expectedIssuer = `${ENTRA_AUTHORITY_BASE_URL}/${input.config.tenantId}/v2.0`;

  if (claims.aud !== input.config.clientId) {
    throw new Error("Microsoft Entra identity token audience did not match this app.");
  }

  if (claims.iss !== expectedIssuer) {
    throw new Error("Microsoft Entra identity token issuer did not match this tenant.");
  }

  if (!claims.exp || claims.exp * 1000 <= Date.now()) {
    throw new Error("Microsoft Entra identity token is expired.");
  }

  if (claims.nonce !== input.nonce) {
    throw new Error("Microsoft Entra identity token nonce did not match this sign-in request.");
  }

  const email = (claims.email || claims.preferred_username || claims.upn || "").trim().toLowerCase();

  if (!email) {
    throw new Error("Microsoft Entra did not return an email or username claim for this account.");
  }

  return {
    email,
    groupIds: Array.isArray(claims.groups) ? claims.groups.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [],
    name: claims.name ?? email,
  };
}
