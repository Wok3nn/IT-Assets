import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ControlStore } from "../src/modules/database-management/control-store";
import type { InstallationConfiguration } from "../src/modules/database-management/installation-configuration";

const fields = { tenantId: "11111111-1111-4111-8111-111111111111", clientId: "22222222-2222-4222-8222-222222222222", redirectUri: "http://localhost:4052/api/auth/entra/callback" };
const secret = "disposable-entra-secret-not-for-production";
const candidate = (): InstallationConfiguration => ({ format: 1, source: { provider: "installation" }, settings: {
  "authentication.entra.tenantId": fields.tenantId, "authentication.entra.clientId": fields.clientId,
  "authentication.entra.redirectUri": fields.redirectUri, "authentication.entra.secretReference": "IT_ASSETS_ENTRA_SECRET_TEST" }, branding: [], timeZone: null, settingsKeyHash: null });
const profile = { name: "Fixture", provider: "mariadb" as const, host: "127.0.0.1", port: 1, database: "entra_fixture", username: "fixture", password: "fixture", trustCertificate: false };
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "entra-installation-")), store = new ControlStore(directory);
  store.enroll(readFileSync(path.join(directory, "bootstrap-token"), "utf8").trim(), "operator@example.invalid", "Disposable Entra password", { siteName: "Fixture", appTitle: "Fixture" });
  const token = store.login("operator@example.invalid", "Disposable Entra password");
  store.stageInstallationConfiguration(candidate());
  return { directory, store, token };
}
test("Entra adoption is atomic, encrypted, restart-safe and independent of database selection", () => {
  const { directory, store, token } = fixture();
  const old = process.env.IT_ASSETS_ENTRA_SECRET_TEST;
  try {
    delete process.env.IT_ASSETS_ENTRA_SECRET_TEST;
    assert.throws(() => store.enableEntra(token, store.presentationCandidateVersion()), /complete verified/);
    assert.equal(store.entraRuntime(), null);
    process.env.IT_ASSETS_ENTRA_SECRET_TEST = secret;
    assert.throws(() => store.enableEntra("workspace-token", store.presentationCandidateVersion()), /sign-in/);
    const db = new DatabaseSync(path.join(directory, "control.sqlite"));
    db.exec("CREATE TRIGGER fail_entra BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'fixture interruption'); END");
    assert.throws(() => store.enableEntra(token, store.presentationCandidateVersion()), /interruption/);
    assert.equal(store.entraRuntime(), null);
    db.exec("DROP TRIGGER fail_entra"); db.close();
    store.enableEntra(token, store.presentationCandidateVersion());
    delete process.env.IT_ASSETS_ENTRA_SECRET_TEST;
    assert.equal(store.entraTransport()!.clientSecret, secret);
    assert.ok(!JSON.stringify(store.entraPublic()).includes(secret));
    const maria = store.save(profile), sql = store.save({ ...profile, provider: "sqlserver" });
    for (const id of [maria, sql, maria]) { store.activate(id, store.state().revision); assert.equal(store.entraTransport()!.clientSecret, secret); }
    assert.equal(store.profileAuthentication(sql), null);
    const version = store.entraPublic()!.version;
    store.saveEntra(token, version, { ...fields, redirectUri: "" }, "");
    assert.throws(() => store.saveEntra(token, version, fields, "stale"), /changed/);
    assert.equal(store.entraTransport()!.clientSecret, secret);
  } finally { store.close(); if (old === undefined) delete process.env.IT_ASSETS_ENTRA_SECRET_TEST; else process.env.IT_ASSETS_ENTRA_SECRET_TEST = old; }
  const restarted = new ControlStore(directory);
  assert.equal(restarted.entraTransport()!.clientSecret, secret); restarted.close();
  assert.ok(!readFileSync(path.join(directory, "control.sqlite")).includes(Buffer.from(secret)));
});
test("explicit Entra reconciliation hides secrets, rejects stale approval and restores encrypted credentials", () => {
  const { store, token } = fixture();
  process.env.IT_ASSETS_ENTRA_SECRET_TEST = secret;
  try {
    store.enableEntra(token, store.presentationCandidateVersion());
    const id = store.save(profile), version = store.profiles()[0].version;
    const replacement = store.installationConfiguration()!;
    replacement.settings["authentication.entra.clientSecret"] = "captured-replacement-secret";
    const review = store.captureConfigurationReview(id, version, replacement);
    store.saveEntra(token, store.entraPublic()!.version, fields, "newest-secret");
    assert.throws(() => store.resolveConfigurationReview(token, review, "profile"), /changed after capture/);
    const fresh = store.captureConfigurationReview(id, version, replacement, true);
    assert.doesNotMatch(JSON.stringify(store.configurationReviews()), /newest-secret|captured-replacement-secret/);
    store.resolveConfigurationReview(token, fresh, "profile");
    store.resolveConfigurationReview(token, fresh, "profile");
    assert.equal(store.entraTransport()!.clientSecret, "captured-replacement-secret");
    store.restoreConfigurationReview(token, fresh);
    store.restoreConfigurationReview(token, fresh);
    assert.equal(store.entraTransport()!.clientSecret, "newest-secret");
    const incomplete = candidate(); delete incomplete.settings["authentication.entra.secretReference"];
    const invalid = store.captureConfigurationReview(id, version, incomplete, true);
    assert.throws(() => store.resolveConfigurationReview(token, invalid, "profile"), /incomplete/);
    assert.equal(store.entraTransport()!.clientSecret, "newest-secret");
  } finally { store.close(); delete process.env.IT_ASSETS_ENTRA_SECRET_TEST; }
});
