import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ControlStore } from "../src/modules/database-management/control-store";
import { prepareManagedConfiguration, readProfileBranding } from "../src/modules/database-management/managed-configuration-capture";
import { encryptAppSettingSecret } from "../src/services/app-settings-encryption";
import type { InstallationConfiguration } from "../src/modules/database-management/installation-configuration";

const profile = { name: "Disposable", provider: "mariadb" as const, host: "127.0.0.1", port: 1, database: "review_fixture", username: "fixture", password: "fixture", trustCertificate: false };
const candidate = (): InstallationConfiguration => ({ format: 1, source: { provider: profile.provider, host: profile.host, port: profile.port, database: profile.database },
  settings: { "app.title": "Captured profile", "session.timeoutMinutes": "35", "mail.clientSecretEncrypted": "opaque-fixture-ciphertext" },
  branding: [], timeZone: "America/Toronto", settingsKeyHash: "a".repeat(64) });
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "configuration-review-")), store = new ControlStore(directory);
  store.enroll(readFileSync(path.join(directory, "bootstrap-token"), "utf8").trim(), "operator@example.invalid", "Disposable review password", { siteName: "Fixture", appTitle: "Installation title" });
  const token = store.login("operator@example.invalid", "Disposable review password");
  store.enablePresentation(token, "new");
  const id = store.save(profile), version = store.profiles()[0].version;
  return { directory, store, token, id, version };
}
test("review capture detects differences without promotion, hides secrets, and retries idempotently", () => {
  const { directory, store, token, id, version } = fixture();
  const review = store.captureConfigurationReview(id, version, candidate());
  assert.equal(store.presentation()!.appTitle, "Installation title");
  assert.equal(store.captureConfigurationReview(id, version, candidate()), review);
  assert.equal(store.configurationReviews().length, 1);
  assert.ok(!JSON.stringify(store.configurationReviews()).includes("opaque-fixture-ciphertext"));
  assert.ok(store.configurationReviews()[0].differences.some(item => item.key === "app.title"));
  assert.deepEqual(store.configurationReviews()[0].source, candidate().source);
  assert.equal(store.configurationReviews()[0].currentTitle, "Installation title");
  assert.equal(store.configurationReviews()[0].capturedTitle, "Captured profile");
  // Rendering/reloading the new public review projection must not resolve or stale it.
  const before = store.configurationReviews()[0];
  const reopened = new ControlStore(directory);
  assert.deepEqual(reopened.configurationReviews()[0], before);
  assert.equal(before.status, "pending");
  assert.equal(before.stale, false);
  reopened.close();
  assert.throws(() => store.resolveConfigurationReview("workspace-token", review, "profile"), /sign-in/);
  store.resolveConfigurationReview(token, review, "keep");
  store.resolveConfigurationReview(token, review, "keep");
  assert.equal(store.presentation()!.appTitle, "Installation title");
  store.close();
  const restarted = new ControlStore(directory);
  assert.equal(restarted.captureConfigurationReview(id, version, candidate()), review);
  assert.equal(restarted.configurationReviews()[0].status, "kept"); restarted.close();
  assert.ok(!readFileSync(path.join(directory, "control.sqlite")).includes(Buffer.from("opaque-fixture-ciphertext")));
});
test("installation edits after capture reject old review; explicit refresh preserves latest rollback baseline", () => {
  const { store, token, id, version } = fixture();
  const review = store.captureConfigurationReview(id, version, candidate());
  store.savePresentation(token, store.presentation()!.version, { appTitle: "Later administrator edit", sessionTimeoutMinutes: 20 });
  assert.throws(() => store.resolveConfigurationReview(token, review, "profile"), /changed after capture/);
  assert.equal(store.presentation()!.appTitle, "Later administrator edit");
  store.resolveConfigurationReview(token, review, "keep");
  assert.equal(store.captureConfigurationReview(id, version, candidate()), review);
  const refreshed = store.captureConfigurationReview(id, version, candidate(), true);
  assert.notEqual(refreshed, review);
  store.resolveConfigurationReview(token, refreshed, "profile");
  assert.equal(store.presentation()!.appTitle, "Captured profile");
  store.restoreConfigurationReview(token, refreshed);
  assert.equal(store.presentation()!.appTitle, "Later administrator edit");
  store.restoreConfigurationReview(token, refreshed); store.close();
});
test("resolution and restoration preserve selection, original profile auth and inventory connection", () => {
  const { store, token, id, version } = fixture();
  const originalProfile = store.profile(id), state = store.state();
  const review = store.captureConfigurationReview(id, version, candidate());
  store.resolveConfigurationReview(token, review, "profile");
  assert.deepEqual(store.state(), state); assert.deepEqual(store.profile(id), originalProfile);
  assert.equal(store.profileAuthentication(id), null);
  store.resolveConfigurationReview(token, review, "profile");
  store.savePresentation(token, store.presentation()!.version, { appTitle: "Newest edit", sessionTimeoutMinutes: 30 });
  assert.throws(() => store.restoreConfigurationReview(token, review), /overwrite later edits/);
  assert.equal(store.presentation()!.appTitle, "Newest edit"); store.close();
});
test("transaction failure rolls back resolution and can be safely retried after reopening", () => {
  const { directory, store, token, id, version } = fixture();
  const review = store.captureConfigurationReview(id, version, candidate()), original = store.presentation();
  const db = new DatabaseSync(path.join(directory, "control.sqlite"));
  db.exec("CREATE TRIGGER fail_review_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'fixture interruption'); END");
  assert.throws(() => store.resolveConfigurationReview(token, review, "profile"), /fixture interruption/);
  assert.deepEqual(store.presentation(), original);
  assert.equal(store.configurationReviews()[0].status, "pending");
  db.exec("DROP TRIGGER fail_review_audit"); db.close(); store.close();
  const restarted = new ControlStore(directory);
  restarted.resolveConfigurationReview(token, review, "profile");
  assert.equal(restarted.presentation()!.appTitle, "Captured profile"); restarted.close();
});
test("resolving a staged-only installation does not enable runtime and can restore an absent snapshot", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "review-no-runtime-")), store = new ControlStore(directory);
  store.enroll(readFileSync(path.join(directory, "bootstrap-token"), "utf8").trim(), "operator@example.invalid", "Disposable review password", { siteName: "Fixture", appTitle: "Original" });
  const token = store.login("operator@example.invalid", "Disposable review password"), id = store.save(profile);
  const review = store.captureConfigurationReview(id, store.profiles()[0].version, candidate());
  store.resolveConfigurationReview(token, review, "profile");
  assert.equal(store.presentation(), null); assert.equal(store.state().active, null);
  store.restoreConfigurationReview(token, review);
  assert.equal(store.installationConfiguration(), null); assert.equal(store.organization()!.appTitle, "Original"); store.close();
});
test("managed capture uses managed IdP edits, verifies ciphertext, excludes workspace grants and normalizes local images", () => {
  const oldKey = process.env.APP_SETTINGS_ENCRYPTION_KEY, oldSecret = process.env.IT_ASSETS_ENTRA_SECRET_REVIEW;
  process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 6).toString("base64url");
  process.env.IT_ASSETS_ENTRA_SECRET_REVIEW = "fixture-secret-never-captured";
  try {
    const encrypted = encryptAppSettingSecret("fixture-mail-secret"), name = "logo-12345678-1234-1234-1234-123456789012.png";
    const settings = new Map([["app.title", "Profile edited"], ["mail.clientSecretEncrypted", encrypted], ["authentication.entra.tenantId", "old-tenant"],
      ["branding.logo.light", "/api/workspace-branding/" + name], ["permissions.role.ADMIN", "do-not-transfer"], ["integrations.deskmap.tokenHash", "do-not-transfer"], ["mail.adminRecipient", "workspace@example.invalid"]]);
    settings.set("branding.logo.dark", "/api/workspace-branding/" + name);
    const auth = { localAuthEnabled: true, entraEnabled: true, entraSsoEnabled: true, entraTenantId: "edited-tenant", entraClientId: "client", entraRedirectUri: "", entraSecretReference: "IT_ASSETS_ENTRA_SECRET_REVIEW", groupMappings: [] };
    const captured = prepareManagedConfiguration(settings, auth, { ...profile, provider: "sqlserver" }, () => Buffer.from("fixture-image"), "America/Toronto");
    assert.equal(captured.settings["authentication.entra.tenantId"], "edited-tenant");
    assert.equal(captured.settings["mail.clientSecretEncrypted"], encrypted);
    assert.equal(captured.settings["branding.logo.light"], "/branding/uploads/" + name);
    assert.equal(captured.branding.length, 1);
    assert.throws(() => prepareManagedConfiguration(settings, auth, profile, () => { throw new Error("missing file"); }), /missing, unsafe or oversized/);
    assert.ok(!JSON.stringify(captured).includes("do-not-transfer"));
    assert.equal(captured.settings["authentication.entra.clientSecret"], "fixture-secret-never-captured");
    assert.equal(settings.get("authentication.entra.tenantId"), "old-tenant");
    process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64url");
    assert.throws(() => prepareManagedConfiguration(settings, auth, profile, () => Buffer.from("fixture")), /original mail settings key/);
  } finally {
    if (oldKey === undefined) delete process.env.APP_SETTINGS_ENCRYPTION_KEY; else process.env.APP_SETTINGS_ENCRYPTION_KEY = oldKey;
    if (oldSecret === undefined) delete process.env.IT_ASSETS_ENTRA_SECRET_REVIEW; else process.env.IT_ASSETS_ENTRA_SECRET_REVIEW = oldSecret;
  }
});
test("profile branding capture reads only bounded files under the named profile", () => {
  const root = mkdtempSync(path.join(tmpdir(), "review-branding-")), name = "logo-12345678-1234-1234-1234-123456789012.png";
  const directory = path.join(root, "workspaces", "fixture-profile", "branding"); mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, name), "fixture-bytes");
  assert.equal(readProfileBranding(root, "fixture-profile", name).toString(), "fixture-bytes");
  assert.throws(() => readProfileBranding(root, "../outside", name), /Unsafe/);
  assert.throws(() => readProfileBranding(root, "fixture-profile", "../control.key"), /Unsafe/);
});
test("capture retains existing timezone precedence and invalid-zone UTC fallback without changing scheduling", () => {
  const oldApp = process.env.APP_TIME_ZONE, oldTZ = process.env.TZ;
  try {
    process.env.APP_TIME_ZONE = "America/Toronto"; process.env.TZ = "Europe/London";
    const capture = () => prepareManagedConfiguration(new Map(), null, profile, () => Buffer.alloc(0));
    assert.equal(capture().timeZone, "America/Toronto");
    delete process.env.APP_TIME_ZONE;
    assert.equal(capture().timeZone, "Europe/London");
    process.env.TZ = "Invalid/Fixture";
    assert.equal(capture().timeZone, "UTC");
  } finally {
    if (oldApp === undefined) delete process.env.APP_TIME_ZONE; else process.env.APP_TIME_ZONE = oldApp;
    if (oldTZ === undefined) delete process.env.TZ; else process.env.TZ = oldTZ;
  }
});
