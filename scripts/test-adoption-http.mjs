// Run after the disposable adoption.test.ts fixture and build:managed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import storeModule from "../src/modules/database-management/control-store.ts";
import schema from "../src/modules/database-management/schema-service.ts";

const root = process.env.IT_ASSETS_ADOPTION_TEST_DIRECTORY;
assert.ok(root && path.isAbsolute(root) && path.basename(root).startsWith("it-assets-adoption-integration-"), "Use only the temporary adoption test fixture directory");
const directory = path.join(root, "control"), base = "http://localhost:4050";
const probe = net.createServer();
await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(4050, "127.0.0.1", resolve); });
await new Promise(resolve => probe.close(resolve));
const store = new storeModule.ControlStore(directory);
const id = "adopted-legacy-mariadb", p = store.profile(id);
assert.equal(p.host, "127.0.0.1"); assert.equal(p.port, 43331); assert.equal(p.database, "it_assets_managed_up5a_test");
assert.equal(await schema.checkProfile(p), "compatible");
if (!store.registered()) store.enroll(readFileSync(path.join(directory, "bootstrap-token"), "utf8").trim(), "operator@example.invalid", "Disposable operator test password.", { siteName: "Adoption fixture", appTitle: "Adoption fixture" });
if (store.state().active !== id) store.activate(id, store.state().revision);
const revision = store.state().revision;
const cookie = "it_assets_management_visit=" + store.login("operator@example.invalid", "Disposable operator test password.");
store.close();
const env = { ...process.env, IT_ASSETS_CONTROL_DIR: directory, IT_ASSETS_BIND: "127.0.0.1", IT_ASSETS_MANAGED_URL: base,
  APP_SETTINGS_ENCRYPTION_KEY: "", IT_ASSETS_MANAGED_SETTINGS_KEY: "", IT_ASSETS_MANAGED_SETTINGS_KEY_FILE: "",
  APP_SETTINGS_ENCRYPTION_KEY_FILE: path.join(root, "key"), IT_ASSETS_ENTRA_SECRET_UPGRADE: "", IT_ASSETS_ENTRA_SECRET_UPGRADE_FILE: path.join(root, "entra") };
const launch = (overrides = {}) => {
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/managed-start.mjs"], {
    env: { ...env, ...overrides }, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const exited = once(child, "exit");
  const ready = new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(Error("Fixture startup timed out")), 60000); deadline.unref();
    child.stdout.on("data", data => { if (String(data).includes("IT Assets ready at")) { clearTimeout(deadline); resolve(); } });
    exited.then(() => { clearTimeout(deadline); reject(Error("Fixture exited before readiness")); });
  });
  // Rejections are consumed below even for the deliberate failed-start case.
  ready.catch(() => {});
  return { child, exited, ready };
};
for (let restart = 0; restart < 2; restart++) {
  const server = launch();
  try {
    await server.ready;
    const readiness = await (await fetch(base + "/setup/status", { headers: { Cookie: cookie } })).json();
    assert.equal(readiness.verified, true); assert.equal(readiness.profile, id); assert.equal(readiness.revision, revision);
    const logo = await fetch(base + "/api/branding/logo/light");
    assert.equal(logo.status, 200);
    assert.deepEqual(Buffer.from(await logo.arrayBuffer()), readFileSync(path.join(root, "branding", "logo-12345678-1234-1234-1234-123456789012.png")));
    const entra = await fetch(base + "/api/auth/entra/start", { redirect: "manual" });
    const target = new URL(entra.headers.get("location"));
    assert.equal(target.hostname, "login.microsoftonline.com");
    assert.equal(target.searchParams.get("client_id"), "client-fixture");
    assert.equal(target.searchParams.get("redirect_uri"), "https://fixture.invalid/api/auth/entra/callback");
    // Do not follow the external URL. This checks preserved configuration, not live SSO.
    const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "x-it-assets-revision": String(revision), Origin: base },
      body: JSON.stringify({ email: "workspace@example.invalid", password: "Disposable workspace password" }) });
    assert.equal(login.status, 200);
    const workspaceCookie = login.headers.getSetCookie().filter(c => !c.includes("Max-Age=0")).map(c => c.split(";")[0]).join("; ");
    const assets = await fetch(base + "/assets", { headers: { Cookie: workspaceCookie } });
    assert.equal(assets.status, 200); assert.match(await assets.text(), /Preserved laptop/);
    const settings = await fetch(base + "/settings/general", { headers: { Cookie: workspaceCookie } });
    assert.equal(settings.status, 200); assert.match(await settings.text(), /Existing production-like inventory/);
  } finally { if (server.child.connected) server.child.send("stop"); await server.exited; }
}
const broken = launch({ APP_SETTINGS_ENCRYPTION_KEY_FILE: path.join(root, "entra") });
const [code] = await broken.exited;
assert.notEqual(code, 0);
console.log("PASS: adopted workspace readiness, original user sign-in/assets/settings, branding bytes, Entra redirect configuration, supervisor restart persistence and wrong-key startup refusal. No external SSO request was made.");
