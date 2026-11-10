import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ControlStore } from "../src/modules/database-management/control-store";
import { parseLegacyConnection, prepareLegacyAuthentication, saveLegacyAdoption } from "../src/modules/database-management/legacy-adoption";
import { managedBrandingUrl } from "../src/modules/database-management/branding-compatibility";
import { coversMariaDatabase } from "../src/modules/database-management/mariadb-grants";

const url = "mysql://operator:p%40ssword@database:3306/inventory";
test("MariaDB scope checks accept Docker's escaped underscores without accepting partial or unrelated grants", () => {
  for (const scope of ["`it\\_assets`.*", "`it_assets`.*", "*.*"]) assert.ok(coversMariaDatabase(scope, "it_assets"));
  for (const scope of ["`other`.*", "`it_assets`.`Asset`", "`it%`.*", "`it\\_assets_backup`.*"]) assert.ok(!coversMariaDatabase(scope, "it_assets"));
});
test("explicit legacy URL parsing preserves encoded credentials and rejects ignored options", () => {
  assert.equal(parseLegacyConnection(url).password, "p@ssword");
  for (const value of [url + "?sslaccept=strict", url + "#fragment", url.replace("mysql:", "postgres:"), "not a URL", "mysql://user@db/inventory"]) {
    assert.throws(() => parseLegacyConnection(value), error => error instanceof Error && !error.message.includes("p%40ssword") && /Unsupported/.test(error.message));
  }
});
test("Entra adoption preserves configuration while retaining only an explicit secret reference", () => {
  const settings = new Map([["authentication.entra.enabled", "true"], ["authentication.entra.secretReference", "OLD_ENTRA_SECRET"],
    ["authentication.local.enabled", "false"], ["authentication.entra.tenantId", "tenant"],
    ["authentication.entra.groupMappings", JSON.stringify([{ roleKey: "ADMIN", roleName: "Admin", groupId: "12345678-1234-1234-1234-123456789012", groupName: "Staff" }])]]);
  const env = { OLD_ENTRA_SECRET: "fixture-secret", IT_ASSETS_ENTRA_SECRET_UPGRADE: "fixture-secret" };
  const result = prepareLegacyAuthentication(settings, env);
  assert.equal(result.localAuthEnabled, false);
  assert.equal(result.entraSecretReference, "IT_ASSETS_ENTRA_SECRET_UPGRADE");
  assert.equal(result.groupMappings[0].roleKey, "ADMIN");
  assert.ok(!JSON.stringify(result).includes("fixture-secret"));
  assert.throws(() => prepareLegacyAuthentication(settings, {}), /unchanged legacy/);
  settings.set("authentication.entra.groupMappings", "[{}]");
  assert.throws(() => prepareLegacyAuthentication(settings, env), /require review/);
});
test("adoption is atomic, inactive, restart-idempotent and never overwrites saved connections", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "adoption-test-"));
  const candidate = { profile: parseLegacyConnection(url), authentication: prepareLegacyAuthentication(new Map()),
    branding: [{ name: "logo-12345678-1234-1234-1234-123456789012.png", bytes: Buffer.from("fixture") }], settingsKeyHash: null, entraSecretHash: null };
  let store = new ControlStore(directory);
  const before = store.save({ ...candidate.profile, name: "Other", database: "another_inventory" });
  const id = saveLegacyAdoption(store, directory, candidate);
  assert.equal(store.state().active, null);
  assert.equal(store.state().revision, 0);
  assert.equal(store.profile(before).database, "another_inventory");
  assert.equal(store.profile(id).password, "p@ssword");
  assert.throws(() => store.save({ ...candidate.profile, database: "different_target" }, id), /separate connection/);
  assert.ok(!readFileSync(path.join(directory, "control.sqlite")).includes(Buffer.from("p@ssword")));
  store.close(); store = new ControlStore(directory);
  assert.equal(saveLegacyAdoption(store, directory, candidate), id);
  assert.equal(store.profiles().length, 2);
  assert.throws(() => saveLegacyAdoption(store, directory, { ...candidate, profile: { ...candidate.profile, password: "changed" } }), /never overwritten/);
  store.remove(id);
  assert.throws(() => saveLegacyAdoption(store, directory, candidate), /already recorded/);
  store.close();
});
test("adoption refuses conflicting profiles", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "adoption-conflict-"));
  const store = new ControlStore(directory);
  const candidate = { profile: parseLegacyConnection(url), authentication: prepareLegacyAuthentication(new Map()), branding: [], settingsKeyHash: null, entraSecretHash: null };
  const id = store.save(candidate.profile);
  assert.throws(() => saveLegacyAdoption(store, directory, candidate), /already has a saved profile/);
  assert.equal(store.profile(id).password, candidate.profile.password);
  assert.equal(store.legacyAdoption(), null);
  store.close();
});
test("legacy branding URLs translate without changing external paths or allowing traversal", () => {
  assert.equal(managedBrandingUrl("/branding/uploads/logo-12345678-1234-1234-1234-123456789012.png"), "/api/workspace-branding/logo-12345678-1234-1234-1234-123456789012.png");
  for (const value of ["/branding/default.png", "https://example.invalid/logo.png", "/branding/uploads/../secret.key"]) assert.equal(managedBrandingUrl(value), value);
});
test("retry after an interrupted branding copy accepts identical files but refuses changed files", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "adoption-orphan-"));
  const target = path.join(directory, "workspaces", "adopted-legacy-mariadb", "branding");
  mkdirSync(target, { recursive: true });
  const file = { name: "logo-12345678-1234-1234-1234-123456789012.png", bytes: Buffer.from("fixture") };
  writeFileSync(path.join(target, file.name), "different");
  const store = new ControlStore(directory);
  const candidate = { profile: parseLegacyConnection(url), authentication: prepareLegacyAuthentication(new Map()), branding: [file], settingsKeyHash: null, entraSecretHash: null };
  assert.throws(() => saveLegacyAdoption(store, directory, candidate), /Nothing was overwritten/);
  assert.equal(store.profiles().length, 0);
  writeFileSync(path.join(target, file.name), file.bytes);
  assert.equal(saveLegacyAdoption(store, directory, candidate), "adopted-legacy-mariadb");
  store.close();
});
test("deployment secrets are explicitly loaded from files and reject ambiguous sources", async () => {
  const { loadDeploymentSecrets } = await import("../scripts/deployment-secrets.mjs");
  const file = path.join(mkdtempSync(path.join(tmpdir(), "secret-file-")), "key");
  writeFileSync(file, "fixture-key\n", { mode: 0o600 });
  const env: Record<string, string> = { APP_SETTINGS_ENCRYPTION_KEY_FILE: file };
  loadDeploymentSecrets(env);
  assert.equal(env.APP_SETTINGS_ENCRYPTION_KEY, "fixture-key");
  assert.throws(() => loadDeploymentSecrets(env), /Configure only/);
});
