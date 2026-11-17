import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { control } from "../../src/modules/database-management/control-store";

async function main() {
  const directory = mkdtempSync(path.join(tmpdir(), "entra-routes-"));
  process.env.IT_ASSETS_MANAGED = "1";
  process.env.IT_ASSETS_CONTROL_DIR = directory;
  process.env.IT_ASSETS_COOKIE_REALM = "fixture";
  process.env.APP_URL = "http://localhost:4052";
  const store = control();
  store.enroll(readFileSync(path.join(directory, "bootstrap-token"), "utf8").trim(), "operator@example.invalid", "Disposable route password", { siteName: "Fixture", appTitle: "Fixture" });
  const token = store.login("operator@example.invalid", "Disposable route password");
  const fields = { tenantId: "11111111-1111-4111-8111-111111111111", clientId: "22222222-2222-4222-8222-222222222222", redirectUri: "" };
  store.stageInstallationConfiguration({ format: 1, source: { provider: "installation" }, settings: {
    "authentication.entra.tenantId": fields.tenantId, "authentication.entra.clientId": fields.clientId,
    "authentication.entra.clientSecret": "disposable-client-secret" }, branding: [], timeZone: null, settingsKeyHash: null });
  store.enableEntra(token, store.presentationCandidateVersion());
  const base = { name: "Fixture", host: "127.0.0.1", port: 1, database: "fixture", username: "fixture", password: "fixture", trustCertificate: false };
  const maria = store.save({ ...base, provider: "mariadb" }), sql = store.save({ ...base, provider: "sqlserver" });
  const groupId = "33333333-3333-4333-8333-333333333333";
  const auth = { localAuthEnabled: true, entraEnabled: true, entraSsoEnabled: true, entraTenantId: "", entraClientId: "", entraSecretReference: "", entraRedirectUri: "", groupMappings: [{ roleKey: "ADMIN", roleName: "Admin", groupId, groupName: "Fixture" }] };
  store.activate(maria, 0); process.env.IT_ASSETS_REVISION = "1"; store.saveAuthentication(auth);
  store.activate(sql, 1); process.env.IT_ASSETS_REVISION = "2"; store.saveAuthentication({ ...auth, groupMappings: [] });
  if (process.argv[2] === "maria") { store.activate(maria, 2); process.env.IT_ASSETS_REVISION = "3"; }
  const isMaria = process.argv[2] === "maria";
  let hasUser = isMaria, sessionCount = 0;
  const mock = {
    setupState: { findFirst: async () => ({ isCompleted: true, createdAt: new Date(), siteName: "Fixture" }) },
    setting: { findMany: async () => [], findUnique: async () => null },
    user: { findUnique: async () => hasUser ? ({ id: "local-user", email: "member@example.invalid", name: "Fixture", passwordHash: "", isActive: true, canLogin: true, createdAt: new Date(), userRoles: [], userScopes: [] }) : null, update: async () => ({}) },
    session: { create: async ({ data }: { data: object }) => { sessionCount++; return { ...data, createdAt: new Date() }; } },
  };
  global.prismaClientsByUrl = new Map([["managed:" + store.state().revision, mock as unknown as PrismaClient]]);
  // Next normally aliases this marker during bundling. Stub only the marker,
  // retaining real route, session, provider and authorization implementations.
  const require = createRequire(path.join(process.cwd(), "package.json"));
  require.cache[require.resolve("server-only")] = { exports: {} } as NodeModule;
  const { GET: start } = await import("../../src/app/api/auth/entra/start/route");
  const { GET: callback } = await import("../../src/app/api/auth/entra/callback/route");
  const { resolveEntraMappedRoleKeys, getEntraAuthenticationConfig } = await import("../../src/modules/settings/authentication-settings.service");
  const { ENTRA_AUTH_STATE_COOKIE_NAME, ENTRA_AUTH_NONCE_COOKIE_NAME } = await import("../../src/services/entra-auth");
  assert.ok(ENTRA_AUTH_STATE_COOKIE_NAME.endsWith("_fixture_" + store.state().revision));
  assert.deepEqual(await resolveEntraMappedRoleKeys([groupId]), isMaria ? ["ADMIN"] : []);
  assert.equal((await getEntraAuthenticationConfig()).clientSecret, "disposable-client-secret");
  const started = await start(), authUrl = new URL(started.headers.get("location")!);
  assert.equal(authUrl.searchParams.get("redirect_uri"), "http://localhost:4052/api/auth/entra/callback");
  assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");
  const cookie = started.cookies.getAll().map(item => `${item.name}=${item.value}`).join("; ");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "fixture" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ aud: fields.clientId, iss: `https://login.microsoftonline.com/${fields.tenantId}/v2.0`, exp: Math.floor(Date.now()/1000)+300, nonce: authUrl.searchParams.get("nonce"), email: "member@example.invalid", groups: [groupId] })).toString("base64url");
  const jwt = header + "." + payload + "." + sign("RSA-SHA256", Buffer.from(header + "." + payload), privateKey).toString("base64url");
  let tokenCalls = 0;
  global.fetch = async (url, init) => {
    if (String(url).endsWith("/token")) {
      tokenCalls++;
      const body = init?.body as URLSearchParams;
      assert.equal(body.get("client_secret"), "disposable-client-secret");
      assert.equal(body.get("redirect_uri"), "http://localhost:4052/api/auth/entra/callback");
      return Response.json({ id_token: jwt, access_token: "fixture-token" });
    }
    assert.ok(String(url).endsWith("/keys"));
    return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "fixture" }] });
  };
  const request = (cookies = cookie, state = authUrl.searchParams.get("state")) => new Request(`http://internal.invalid:4050/api/auth/entra/callback?code=fixture&state=${state}`, { headers: { cookie: cookies } });
  assert.match((await callback(request(cookie, "forged"))).headers.get("location")!, /invalid-state/);
  const oldCookie = cookie.replaceAll(ENTRA_AUTH_STATE_COOKIE_NAME, ENTRA_AUTH_STATE_COOKIE_NAME + "_old").replaceAll(ENTRA_AUTH_NONCE_COOKIE_NAME, ENTRA_AUTH_NONCE_COOKIE_NAME + "_old");
  assert.match((await callback(request(oldCookie))).headers.get("location")!, /invalid-state/);
  const response = await callback(request());
  assert.match(response.headers.get("location")!, isMaria ? /localhost:4052\/dashboard/ : /no-matching-user/);
  assert.equal(sessionCount, isMaria ? 1 : 0);
  if (!isMaria) {
    hasUser = true; // Explicitly provisioned SQL identity still inherits no Maria role mapping.
    const admitted = await callback(request());
    assert.match(admitted.headers.get("location")!, /dashboard/);
    assert.ok(admitted.cookies.getAll().filter(c => c.name.includes("session_roles")).every(c => !c.value));
  }
  store.saveEntra(token, store.entraPublic()!.version, fields, "replacement-secret");
  const before = tokenCalls;
  assert.match((await callback(request())).headers.get("location")!, /configuration-changed/);
  assert.equal(tokenCalls, before);
  store.activate(null, store.state().revision);
  assert.match((await start()).headers.get("location")!, /setup/);
  store.close();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
