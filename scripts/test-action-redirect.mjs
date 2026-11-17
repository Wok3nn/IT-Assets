import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import http from "node:http";
import net from "node:net";
import storeModule from "../src/modules/database-management/control-store.ts";
const { encodeReply } = createRequire(import.meta.url)("next/dist/compiled/react-server-dom-webpack/client.node");
// Separate loopback address avoids the operator's localhost SSH tunnel.
const probe = net.createServer();
probe.listen(4050, "127.0.0.2");
await once(probe, "listening");
await new Promise(resolve => probe.close(resolve));
const directory = mkdtempSync(path.join(tmpdir(), "it-assets-redirect-"));
const store = new storeModule.ControlStore(directory);
store.enroll(readFileSync(path.join(directory, "bootstrap-token"), "utf8").trim(), "operator@example.invalid", "Disposable redirect password", { siteName: "Redirect fixture", appTitle: "Redirect fixture" });
store.close();
const manifest = JSON.parse(readFileSync(".next-managed/server/server-reference-manifest.json", "utf8"));
const action = Object.keys(manifest.node).find(id => manifest.node[id].exportedName === "databaseAction");
assert.ok(action);
const server = spawn(process.execPath, ["--import", "tsx", "scripts/managed-start.mjs"], {
  env: { ...process.env, IT_ASSETS_CONTROL_DIR: directory, IT_ASSETS_MANAGED_URL: "http://localhost:4052", IT_ASSETS_BIND: "127.0.0.2" },
  stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true,
});
const exited = once(server, "exit");
let logs = "", cookie = "";
server.stderr.on("data", chunk => { logs += String(chunk); process.stderr.write(chunk); });
try {
  await Promise.race([new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Startup timeout")), 60000); timer.unref();
    server.stdout.on("data", chunk => { process.stdout.write(chunk); if (String(chunk).includes("IT Assets ready at")) { clearTimeout(timer); resolve(); } });
  }), exited.then(() => { throw Error("Test listener unavailable"); })]);
  async function post(op, values = {}, origin = "http://localhost:4052", forwarded = false) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ op, context: "setup", ...values })) form.set(key, value);
    console.log("Testing action: " + op);
    // Serialize React's multipart body, then use http.request to preserve Host
    // (some Node fetch versions override a caller-provided Host header).
    const encoded = new Request("http://127.0.0.2:4050/setup/workspace", { method: "POST", body: await encodeReply([form]) });
    const body = Buffer.from(await encoded.arrayBuffer());
    const response = await new Promise((resolve, reject) => {
      const req = http.request(encoded.url, { method: "POST", signal: AbortSignal.timeout(15000), headers: {
        ...Object.fromEntries(encoded.headers), Host: forwarded ? "internal.invalid:4050" : "localhost:4052",
        ...(forwarded ? { "X-Forwarded-Host": typeof forwarded === "string" ? forwarded : "localhost:4052" } : {}),
        Origin: origin, "Next-Action": action, Cookie: cookie,
      } }, res => {
        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => {
          const headers = new Headers();
          for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }));
        });
      });
      req.on("error", reject); req.end(body);
    });
    const session = response.headers.getSetCookie().find(value => value.startsWith("it_assets_management_visit="));
    if (session) cookie = session.split(";")[0];
    return response;
  }
  const login = await post("login", { email: "operator@example.invalid", password: "Disposable redirect password", returnStep: "3" });
  console.log("Login response: " + login.status); assert.equal(login.status, 303);
  assert.match(login.headers.get("content-type"), /text\/x-component/);
  assert.match(await login.text(), /Database Connection/);
  const enabled = await post("presentation-enable", { confirmation: "ENABLE", version: "new", context: "management" });
  assert.equal(enabled.status, 303);
  assert.match(enabled.headers.get("x-action-redirect"), /presentation%20enabled/); await enabled.text();
  const observer = new storeModule.ControlStore(directory);
  try {
    const version = observer.presentation().version;
    const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKVcAAAAASUVORK5CYII=", "base64");
    const saved = await post("presentation-save", { version, appTitle: "Persistent offline fixture", sessionTimeoutMinutes: "30", context: "management", "branding.logo.light": new File([imageBytes], "logo.png", { type: "image/png" }) });
    assert.equal(saved.status, 303);
    assert.match(saved.headers.get("x-action-redirect"), /settings%20saved/); await saved.text();
    assert.equal(observer.presentation().appTitle, "Persistent offline fixture");
    const branding = await fetch("http://127.0.0.2:4050" + observer.presentation().branding.lightLogoUrl);
    assert.equal(branding.status, 200);
    assert.deepEqual(Buffer.from(await branding.arrayBuffer()), imageBytes);
    const alias = await fetch("http://127.0.0.2:4050/api/branding/logo/light", { redirect: "manual" });
    assert.equal(alias.status, 307);
    assert.equal(new URL(alias.headers.get("location")).pathname, observer.presentation().branding.lightLogoUrl);
    const offline = await fetch("http://127.0.0.2:4050/settings/database-management/workspace", { headers: { Cookie: cookie } });
    assert.equal(offline.status, 200);
    const html = await offline.text();
    assert.match(html, /Persistent offline fixture/);
    assert.match(html, /Save installation settings/);
    const stale = await post("presentation-save", { version, appTitle: "Lost update", sessionTimeoutMinutes: "20" });
    await stale.text();
    assert.equal(observer.presentation().appTitle, "Persistent offline fixture");
  } finally { observer.close(); }
  for (let i = 0; i < 2; i++) {
    const response = await post("save", { name: "Offline " + i, provider: "sqlserver", host: "127.0.0.1", port: "1", database: "redirect_fixture", username: "fixture", password: "fixture", revision: "0" }, "http://localhost:4052", i === 1);
    assert.equal(response.status, 303);
    assert.match(response.headers.get("content-type"), /text\/x-component/);
    assert.match(response.headers.get("x-action-redirect"), /Profile%20saved/);
    await response.text();
  }
  const reviewObserver = new storeModule.ControlStore(directory);
  try {
    const profile = reviewObserver.profiles()[0], captured = reviewObserver.installationConfiguration();
    captured.settings["app.title"] = "Reviewed offline fixture";
    captured.source = { provider: profile.provider, host: profile.host, port: profile.port, database: profile.database };
    const reviewId = reviewObserver.captureConfigurationReview(profile.id, profile.version, captured);
    const reviewPage = await fetch("http://127.0.0.2:4050/settings/database-management/workspace", { headers: { Cookie: cookie } });
    assert.equal(reviewPage.status, 200); assert.match(await reviewPage.text(), /Captured configuration reviews/);
    const applied = await post("configuration-resolve", { id: reviewId, decision: "profile", confirmation: "APPLY SNAPSHOT", context: "management" });
    assert.equal(applied.status, 303); await applied.text();
    assert.equal(reviewObserver.presentation().appTitle, "Reviewed offline fixture");
    const restored = await post("configuration-restore", { id: reviewId, confirmation: "RESTORE", context: "management" });
    assert.equal(restored.status, 303); await restored.text();
    assert.equal(reviewObserver.presentation().appTitle, "Persistent offline fixture");
    const entra = reviewObserver.installationConfiguration();
    entra.settings["authentication.entra.tenantId"] = "11111111-1111-4111-8111-111111111111";
    entra.settings["authentication.entra.clientId"] = "22222222-2222-4222-8222-222222222222";
    entra.settings["authentication.entra.clientSecret"] = "http-fixture-secret";
    const entraReview = reviewObserver.captureConfigurationReview(profile.id, profile.version, entra, true);
    await (await post("configuration-resolve", { id: entraReview, decision: "profile", confirmation: "APPLY SNAPSHOT", context: "management" })).text();
    const enabledEntra = await post("entra-enable", { version: reviewObserver.presentationCandidateVersion(), confirmation: "ENABLE", context: "management" });
    assert.equal(enabledEntra.status, 303); await enabledEntra.text();
    assert.ok(reviewObserver.entraPublic().credentialConfigured);
    const version = reviewObserver.entraPublic().version;
    const fields = { version, tenantId: entra.settings["authentication.entra.tenantId"], clientId: entra.settings["authentication.entra.clientId"], redirectUri: "http://localhost:4052/api/auth/entra/callback", clientSecret: "http-replacement-secret", context: "management" };
    const savedEntra = await post("entra-save", fields, "http://localhost:4052", true);
    assert.equal(savedEntra.status, 303); await savedEntra.text();
    assert.equal(reviewObserver.entraTransport().clientSecret, "http-replacement-secret");
    await (await post("entra-save", { ...fields, clientSecret: "stale-secret" })).text();
    assert.equal(reviewObserver.entraTransport().clientSecret, "http-replacement-secret");
    const rejectedEntra = await post("entra-save", { ...fields, version: reviewObserver.entraPublic().version }, "http://attacker.invalid", "attacker.invalid");
    assert.ok(rejectedEntra.status >= 400); await rejectedEntra.text();
    const entraPage = await fetch("http://127.0.0.2:4050/settings/database-management/workspace", { headers: { Cookie: cookie } });
    const entraHtml = await entraPage.text();
    assert.match(entraHtml, /Save installation Entra credentials/);
    assert.doesNotMatch(entraHtml, /http-fixture-secret|http-replacement-secret/);
    const mailEnable = await post("mail-enable", { version: reviewObserver.presentationCandidateVersion(), confirmation: "ENABLE", context: "management" });
    assert.equal(mailEnable.status, 303); await mailEnable.text();
    const mailVersion = reviewObserver.mailPublic().version;
    const mailFields = { version: mailVersion, tenantId: entra.settings["authentication.entra.tenantId"], clientId: entra.settings["authentication.entra.clientId"], senderMailbox: "fixture@example.invalid", clientSecret: "http-mail-secret", context: "management" };
    const mailSave = await post("mail-save", mailFields, "http://localhost:4052", true);
    assert.equal(mailSave.status, 303); await mailSave.text();
    assert.equal(reviewObserver.mailTransport().clientSecret, "http-mail-secret");
    await (await post("mail-save", { ...mailFields, clientSecret: "lost-mail-secret" })).text();
    assert.equal(reviewObserver.mailTransport().clientSecret, "http-mail-secret");
    const timezoneEnable = await post("timezone-enable", { version: reviewObserver.presentationCandidateVersion(), confirmation: "ENABLE", context: "management" });
    assert.equal(timezoneEnable.status, 303); await timezoneEnable.text();
    const timeVersion = reviewObserver.timezone().version;
    await (await post("timezone-save", { version: timeVersion, timeZone: "America/Toronto", context: "management" })).text();
    assert.equal(reviewObserver.timezone().timeZone, "America/Toronto");
    await (await post("timezone-save", { version: timeVersion, timeZone: "UTC" })).text();
    assert.equal(reviewObserver.timezone().timeZone, "America/Toronto");
    const invalidZone = await post("timezone-save", { version: reviewObserver.timezone().version, timeZone: "Invalid/Zone" });
    await invalidZone.text(); assert.equal(reviewObserver.timezone().timeZone, "America/Toronto");
    const offlineMailPage = await fetch("http://127.0.0.2:4050/settings/database-management/workspace", { headers: { Cookie: cookie } });
    const mailHtml = await offlineMailPage.text();
    assert.match(mailHtml, /Save installation mail transport/); assert.match(mailHtml, /America\/Toronto/);
    assert.doesNotMatch(mailHtml, /http-mail-secret|http-replacement-secret/);
    const mailForbidden = await post("mail-save", { ...mailFields, version: reviewObserver.mailPublic().version, clientSecret: "forged-mail-secret" }, "http://attacker.invalid", "attacker.invalid");
    assert.ok(mailForbidden.status >= 400); await mailForbidden.text();
    assert.equal(reviewObserver.mailTransport().clientSecret, "http-mail-secret");
    const timezoneForbidden = await post("timezone-save", { version: reviewObserver.timezone().version, timeZone: "UTC" }, "http://attacker.invalid", "attacker.invalid");
    assert.ok(timezoneForbidden.status >= 400); await timezoneForbidden.text();
    assert.equal(reviewObserver.timezone().timeZone, "America/Toronto");
  } finally { reviewObserver.close(); }
  const forbidden = await post("save", {}, "http://attacker.invalid");
  assert.ok(forbidden.status >= 400); await forbidden.text();
  // Matching forged proxy headers must still fail the application's APP_URL check.
  const forged = await post("save", {}, "http://attacker.invalid", "attacker.invalid");
  assert.ok(forged.status >= 400); await forged.text();
  const logout = await post("logout");
  assert.equal(logout.status, 303); await logout.text();
  const session = await fetch("http://127.0.0.2:4050/settings/database-management/session", { headers: { Host: "localhost:4052", Cookie: cookie } });
  assert.equal(session.status, 401);
  const rejected = await post("presentation-save", { appTitle: "Unauthorized", sessionTimeoutMinutes: "20" });
  assert.match(rejected.headers.get("x-action-redirect"), /Session%20expired/); await rejected.text();
  const rejectedEntraLogout = await post("entra-save", {});
  assert.match(rejectedEntraLogout.headers.get("x-action-redirect"), /Session%20expired/); await rejectedEntraLogout.text();
  for (const op of ["mail-save", "timezone-save"]) {
    const denied = await post(op); assert.match(denied.headers.get("x-action-redirect"), /Session%20expired/); await denied.text();
  }
  assert.doesNotMatch(logs, /failed to get redirect response|ECONNREFUSED.*4052/);
  console.log("PASS: mapped-port redirects, presentation cutover/save/upload, configuration review/apply/restore, Entra/mail/timezone enable/save, offline management and branding, stale-write rejection, profile saves, foreign-origin rejection and logout; isolated control store only.");
} finally { if (server.connected) server.send("stop"); await exited; }
