import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ControlStore, control } from "../src/modules/database-management/control-store";
import { brandingResponse } from "../src/modules/database-management/installation-presentation";
import { presentationUploads } from "../src/modules/database-management/presentation-upload";
import type { InstallationConfiguration } from "../src/modules/database-management/installation-configuration";

const imageName = "logo-12345678-1234-1234-1234-123456789012.png";
const bytes = Buffer.from([137,80,78,71,13,10,26,10,0]);
const candidate = (): InstallationConfiguration => ({ format: 1, source: { provider: "mariadb", host: "127.0.0.1", port: 1, database: "fixture" },
  settings: { "app.title": "Fixture", "session.timeoutMinutes": "25", "branding.logo.light": "/branding/uploads/" + imageName,
    "mail.clientSecretEncrypted": "preserved-opaque-ciphertext", "authentication.entra.secretReference": "IT_ASSETS_ENTRA_SECRET_FIXTURE" },
  branding: [{ name: imageName, base64: bytes.toString("base64") }], timeZone: null, settingsKeyHash: "a".repeat(64) });
const profile = { name: "Fixture", provider: "mariadb" as const, host: "127.0.0.1", port: 1, database: "fixture", username: "fixture", password: "fixture", trustCertificate: false };
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "presentation-test-"));
  const store = new ControlStore(directory);
  store.enroll(readFileSync(path.join(directory, "bootstrap-token"), "utf8").trim(), "operator@example.invalid", "Disposable presentation password", { siteName: "Fixture", appTitle: "Fixture" });
  const token = store.login("operator@example.invalid", "Disposable presentation password");
  return { directory, store, token };
}
test("explicit cutover preserves staged values and rejects workspace tokens or stale confirmation", () => {
  const { store, token } = fixture();
  try {
    store.stageInstallationConfiguration(candidate());
    assert.equal(store.presentation(), null);
    assert.throws(() => store.enablePresentation("workspace-session", store.presentationCandidateVersion()), /sign-in required/);
    assert.throws(() => store.enablePresentation(token, "stale"), /changed/);
    store.enablePresentation(token, store.presentationCandidateVersion());
    assert.equal(store.presentation()!.appTitle, "Fixture");
    assert.equal(store.presentation()!.sessionTimeoutMinutes, 25);
    assert.match(store.presentation()!.branding.lightLogoUrl, /^\/api\/installation-branding\//);
    assert.throws(() => store.enablePresentation(token, "stale"), /already active/);
  } finally { store.close(); }
});
test("runtime writes propagate across handles, survive selection and restart, and do not reimport over edits", () => {
  const { directory, store, token } = fixture();
  store.stageInstallationConfiguration(candidate()); store.enablePresentation(token, store.presentationCandidateVersion());
  const second = new ControlStore(directory), version = store.presentation()!.version;
  try {
    store.savePresentation(token, version, { appTitle: "Updated fixture", sessionTimeoutMinutes: 40 });
    assert.equal(second.presentation()!.appTitle, "Updated fixture");
    assert.equal(store.organization()!.appTitle, "Updated fixture");
    assert.throws(() => second.savePresentation(token, version, { appTitle: "Lost update", sessionTimeoutMinutes: 20 }), /changed/);
    assert.equal(store.stageInstallationConfiguration(candidate()), "unchanged");
    assert.equal(store.presentation()!.appTitle, "Updated fixture");
    const maria = store.save(profile), sql = store.save({ ...profile, provider: "sqlserver", database: "other_fixture" });
    for (const id of [maria, sql, maria, null]) { store.activate(id, store.state().revision); assert.equal(store.presentation()!.sessionTimeoutMinutes, 40); }
    assert.equal(store.installationConfiguration()!.settings["mail.clientSecretEncrypted"], "preserved-opaque-ciphertext");
    store.logout(token);
    assert.throws(() => store.savePresentation(token, store.presentation()!.version, { appTitle: "Unauthorized", sessionTimeoutMinutes: 20 }), /sign-in required/);
  } finally { second.close(); store.close(); }
  const restarted = new ControlStore(directory);
  assert.equal(restarted.presentation()!.appTitle, "Updated fixture"); restarted.close();
});
test("existing profiles require staged adoption and fresh setup can explicitly enable local defaults", () => {
  const { store, token } = fixture();
  const id = store.save(profile);
  assert.throws(() => store.enablePresentation(token, "new"), /Stage the existing/);
  store.remove(id); store.enablePresentation(token, "new");
  const organization = store.organization()!;
  store.saveOrganization({ appTitle: "Synchronized", siteName: organization.siteName }, organization.version);
  assert.equal(store.presentation()!.appTitle, "Synchronized"); store.close();
});
test("failed runtime save rolls back settings, organization, files and version together", () => {
  const { directory, store, token } = fixture();
  store.stageInstallationConfiguration(candidate()); store.enablePresentation(token, store.presentationCandidateVersion());
  const before = store.presentation(), organization = store.organization(), configuration = store.installationConfiguration();
  const db = new DatabaseSync(path.join(directory, "control.sqlite"));
  db.exec("CREATE TRIGGER fail_runtime_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
  assert.throws(() => store.savePresentation(token, before!.version, { appTitle: "Not committed", sessionTimeoutMinutes: 45 }), /fixture failure/);
  assert.deepEqual(store.presentation(), before);
  assert.deepEqual(store.organization(), organization);
  assert.deepEqual(store.installationConfiguration(), configuration);
  db.exec("DROP TRIGGER fail_runtime_audit"); db.close(); store.close();
});
test("branding serves only published allowlisted files independently of selection", async () => {
  const { store, token } = fixture();
  store.stageInstallationConfiguration(candidate()); store.enablePresentation(token, store.presentationCandidateVersion());
  const response = brandingResponse(store.installationConfiguration(), imageName);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  for (const name of ["../control.key", "%2e%2e%2fcontrol.key", "mail.clientSecretEncrypted", "logo-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png"])
    assert.equal(brandingResponse(store.installationConfiguration(), name).status, 404);
  store.close();
});
test("shared presentation does not copy profile authentication mappings or authorize workspace sessions", () => {
  const { store, token } = fixture(), previousRevision = process.env.IT_ASSETS_REVISION;
  try {
    store.enablePresentation(token, "new");
    const maria = store.save(profile), sql = store.save({ ...profile, provider: "sqlserver", database: "isolated_sql" });
    store.activate(maria, store.state().revision); process.env.IT_ASSETS_REVISION = String(store.state().revision);
    const authentication = { entraSecretReference: "IT_ASSETS_ENTRA_SECRET_FIXTURE", groupMappings: [{ groupId: "fixture-group", roleKey: "SUPER_ADMIN" }] };
    store.saveAuthentication(authentication);
    store.activate(sql, store.state().revision); process.env.IT_ASSETS_REVISION = String(store.state().revision);
    assert.equal(store.authentication(), null);
    assert.equal(store.authorized("mariadb-workspace-session"), false);
    assert.equal(store.presentation()!.appTitle, "Fixture");
    store.activate(maria, store.state().revision); process.env.IT_ASSETS_REVISION = String(store.state().revision);
    assert.deepEqual(store.authentication(), authentication);
  } finally {
    if (previousRevision === undefined) delete process.env.IT_ASSETS_REVISION; else process.env.IT_ASSETS_REVISION = previousRevision;
    store.close();
  }
});
test("branding upload validation rejects spoofed types and publishes bytes and reference atomically", async () => {
  const form = new FormData();
  form.set("branding.logo.light", new File(["not a png"], "spoof.png", { type: "image/png" }));
  await assert.rejects(() => presentationUploads(form), /signature/);
  form.set("branding.logo.light", new File([bytes], "../../outside.png", { type: "image/png" }));
  const uploads = await presentationUploads(form);
  assert.match(uploads[0].name, /^logo-[a-f0-9-]+\.png$/);
  const { store, token } = fixture();
  store.stageInstallationConfiguration(candidate()); store.enablePresentation(token, store.presentationCandidateVersion());
  store.savePresentation(token, store.presentation()!.version, { appTitle: "Fixture", sessionTimeoutMinutes: 25 }, uploads);
  assert.equal(brandingResponse(store.installationConfiguration(), imageName).status, 404);
  assert.equal(brandingResponse(store.installationConfiguration(), uploads[0].name).status, 200);
  assert.equal(store.installationConfiguration()!.branding.length, 1); store.close();
});
test("actual branding and session runtime services read control authority with no inventory and block workspace writes", async () => {
  const { directory, store, token } = fixture();
  store.stageInstallationConfiguration(candidate()); store.enablePresentation(token, store.presentationCandidateVersion()); store.close();
  const oldManaged = process.env.IT_ASSETS_MANAGED, oldDirectory = process.env.IT_ASSETS_CONTROL_DIR;
  process.env.IT_ASSETS_MANAGED = "1"; process.env.IT_ASSETS_CONTROL_DIR = directory;
  try {
    const settings = await import("../src/modules/settings/settings.service");
    assert.equal(await settings.getSessionTimeoutMinutes(), 25);
    assert.match((await settings.getBrandingSettings()).lightLogoUrl, /installation-branding/);
    assert.equal((await settings.getAppShellBrandingSettings()).appTitle, "Fixture");
    await assert.rejects(() => settings.updateBrandingSettings({}), /installation administrator/);
    await assert.rejects(() => settings.updateGeneralSettings({ appTitle: "Unauthorized", sessionTimeoutMinutes: 25, startingAssetTagNumber: 1, makeModelMakeSourceLevel: "category", makeModelModelSourceLevel: "subCategory1" }), /installation administrator/);
  } finally {
    control().close();
    if (oldManaged === undefined) delete process.env.IT_ASSETS_MANAGED; else process.env.IT_ASSETS_MANAGED = oldManaged;
    if (oldDirectory === undefined) delete process.env.IT_ASSETS_CONTROL_DIR; else process.env.IT_ASSETS_CONTROL_DIR = oldDirectory;
  }
});
