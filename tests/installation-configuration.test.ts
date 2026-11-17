import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ControlStore } from "../src/modules/database-management/control-store";
import { parseLegacyConnection, prepareInstallationConfiguration } from "../src/modules/database-management/legacy-adoption";
import { encryptAppSettingSecret } from "../src/services/app-settings-encryption";
import type { InstallationConfiguration } from "../src/modules/database-management/installation-configuration";

const profile = parseLegacyConnection("mysql://fixture:fixture@127.0.0.1:1/disposable_config");
const fixture = (): InstallationConfiguration => ({
  format: 1, source: { provider: "mariadb", host: profile.host, port: profile.port, database: profile.database },
  settings: { "app.title": "Private fixture title", "authentication.entra.secretReference": "IT_ASSETS_ENTRA_SECRET_FIXTURE" },
  timeZone: "America/Toronto", branding: [], settingsKeyHash: null,
});
const directory = () => mkdtempSync(path.join(tmpdir(), "installation-config-test-"));

test("configuration staging persists independently of selection, disconnect, restart and profile removal", () => {
  const dir = directory(); let store = new ControlStore(dir);
  try {
    assert.equal(store.stageInstallationConfiguration(fixture()), "imported");
    const maria = store.save(profile), sql = store.save({ ...profile, provider: "sqlserver", database: "disposable_sql" });
    for (const id of [maria, sql, maria, null]) {
      store.activate(id, store.state().revision);
      assert.deepEqual(store.installationConfiguration(), fixture());
    }
    store.remove(maria); store.remove(sql);
    store.close(); store = new ControlStore(dir);
    assert.deepEqual(store.installationConfiguration(), fixture());
    assert.equal(store.stageInstallationConfiguration(fixture()), "unchanged");
    assert.equal(store.registered(), false); // no installation or workspace account created
    assert.equal(store.authorized("unrelated-workspace-token"), false);
  } finally { store.close(); }
});

test("conflicts and invalid keys cannot overwrite staged configuration or installation organization", () => {
  const store = new ControlStore(directory());
  try {
    store.saveOrganization({ siteName: "Existing", appTitle: "Different title" }, "");
    assert.throws(() => store.stageInstallationConfiguration(fixture()), /conflicts/);
    assert.equal(store.installationConfiguration(), null);
    const candidate = fixture(); candidate.settings["app.title"] = "Different title";
    store.stageInstallationConfiguration(candidate);
    assert.throws(() => store.stageInstallationConfiguration(fixture()), /differs/);
    const forbidden = { ...candidate, settings: { "permissions.role.ADMIN": "secret-grant" } };
    assert.throws(() => store.stageInstallationConfiguration(forbidden as InstallationConfiguration), /validation/);
    assert.deepEqual(store.installationConfiguration(), candidate);
  } finally { store.close(); }
});

test("control encryption protects values and detects tampering and wrong keys", () => {
  const dir = directory(); let store = new ControlStore(dir);
  store.stageInstallationConfiguration(fixture()); store.close();
  assert.ok(!readFileSync(path.join(dir, "control.sqlite")).includes(Buffer.from("Private fixture title")));
  const key = readFileSync(path.join(dir, "control.key"));
  writeFileSync(path.join(dir, "control.key"), Buffer.alloc(32, 7).toString("base64url"));
  store = new ControlStore(dir);
  assert.throws(() => store.installationConfiguration(), /matching control store/); store.close();
  writeFileSync(path.join(dir, "control.key"), key);
  const db = new DatabaseSync(path.join(dir, "control.sqlite"));
  db.prepare("UPDATE installation_config SET envelope='invalid'").run(); db.close();
  store = new ControlStore(dir);
  assert.throws(() => store.installationConfiguration(), /matching control store/); store.close();
});

test("interrupted SQLite staging rolls back atomically and can be retried", () => {
  const dir = directory(); const store = new ControlStore(dir);
  const db = new DatabaseSync(path.join(dir, "control.sqlite"));
  db.exec("CREATE TRIGGER fail_configuration_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'fixture interruption'); END");
  assert.throws(() => store.stageInstallationConfiguration(fixture()), /fixture interruption/);
  assert.equal(store.installationConfiguration(), null);
  db.exec("DROP TRIGGER fail_configuration_audit"); db.close();
  assert.equal(store.stageInstallationConfiguration(fixture()), "imported"); store.close();
});

test("snapshot-only stores never regenerate a missing encryption key", () => {
  const dir = directory(); const store = new ControlStore(dir);
  store.stageInstallationConfiguration(fixture()); store.close();
  const keyFile = path.join(dir, "control.key");
  const key = readFileSync(keyFile);
  unlinkSync(keyFile);
  assert.throws(() => new ControlStore(dir), /restore the original key/);
  assert.equal(existsSync(keyFile), false);
  writeFileSync(keyFile, key);
  const restored = new ControlStore(dir);
  assert.deepEqual(restored.installationConfiguration(), fixture()); restored.close();
});

test("legacy snapshot allowlist excludes workspace privileges, tokens and notification policies", () => {
  const settings = new Map([
    ["app.title", "Legacy title"], ["authentication.entra.tenantId", "tenant"],
    ["authentication.entra.groupMappings", "[]"], ["authentication.local.enabled", "false"],
    ["authentication.entra.enabled", "false"], ["permissions.role.ADMIN", "grant"],
    ["integrations.deskmap.tokenHash", "hash"], ["integrations.deskmap.grant.local.user", "user"],
    ["mail.adminRecipient", "inventory@example.invalid"], ["mail.dueReminderEnabled", "true"],
    ["assets.startingTagNumber", "1000"], ["future.unknown", "not-approved"],
  ]);
  const before = [...settings];
  const result = prepareInstallationConfiguration(settings, profile, []);
  assert.deepEqual(result.settings, { "app.title": "Legacy title", "authentication.entra.tenantId": "tenant" });
  assert.deepEqual([...settings], before); // legacy rollback source is not rewritten
});

test("legacy mail ciphertext requires the original key and stays unchanged inside the encrypted snapshot", () => {
  const previous = process.env.APP_SETTINGS_ENCRYPTION_KEY;
  try {
    process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64url");
    const ciphertext = encryptAppSettingSecret("disposable-mail-secret");
    const settings = new Map([["mail.clientSecretEncrypted", ciphertext]]);
    const payload = prepareInstallationConfiguration(settings, profile, []);
    assert.equal(payload.settings["mail.clientSecretEncrypted"], ciphertext);
    assert.equal(payload.settings["mail.clientSecret"], "disposable-mail-secret");
    const dir = directory(), store = new ControlStore(dir);
    store.stageInstallationConfiguration(payload); store.close();
    assert.ok(!readFileSync(path.join(dir, "control.sqlite")).includes(Buffer.from("disposable-mail-secret")));
    process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 10).toString("base64url");
    assert.throws(() => prepareInstallationConfiguration(settings, profile, []), /original settings key/);
  } finally {
    if (previous === undefined) delete process.env.APP_SETTINGS_ENCRYPTION_KEY;
    else process.env.APP_SETTINGS_ENCRYPTION_KEY = previous;
  }
});

test("branding bytes and references commit together and survive restart without workspace file paths", () => {
  const dir = directory(); let store = new ControlStore(dir);
  const payload = fixture();
  const name = "logo-12345678-1234-1234-1234-123456789012.png";
  payload.settings["branding.logo.light"] = "/branding/uploads/" + name;
  assert.throws(() => store.stageInstallationConfiguration(payload), /validation/);
  assert.equal(store.installationConfiguration(), null);
  payload.branding = [{ name, base64: Buffer.from("disposable-image-bytes").toString("base64") }];
  store.stageInstallationConfiguration(payload); store.close();
  store = new ControlStore(dir);
  assert.deepEqual(store.installationConfiguration(), payload);
  store.close();
});
