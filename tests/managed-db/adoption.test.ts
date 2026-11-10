import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Prisma } from "@prisma/client";
import { DatabaseSync } from "node:sqlite";
import { ControlStore, profileSchema } from "../../src/modules/database-management/control-store";
import { initializeProfile, checkProfile } from "../../src/modules/database-management/schema-service";
import { connectionUrl, createProfileClient } from "../../src/modules/database-management/profile-client";
import { hashPassword } from "../../src/services/password";
import { encryptAppSettingSecret, decryptAppSettingSecret } from "../../src/services/app-settings-encryption";
import { legacyProfileId } from "../../src/modules/database-management/legacy-adoption";
import { createIntegrationToken, matchesIntegrationToken } from "../../src/modules/integrations/integration-security";
const run = promisify(execFile);

test("representative legacy MariaDB adoption preserves every row, files and secrets through retry, reconnect and selection rollback", async () => {
  const docker = process.env.IT_ASSETS_UPGRADE_TEST_DOCKER === "1";
  const password = process.env.IT_ASSETS_TEST_PASSWORD;
  assert.ok(password, "Set the disposable fixture password");
  // Fixed test-only names; no arbitrary target URL or production database accepted.
  const p = profileSchema.parse({ name: "Fixture", provider: "mariadb", host: docker ? "mariadb" : "127.0.0.1",
    port: docker ? 3306 : 43331, database: "it_assets_managed_up5a_test", username: "it_assets_test", password, trustCertificate: false });
  assert.equal(await checkProfile(p), "empty", "This test requires a new disposable fixture; it never resets a populated database");
  await initializeProfile(p, "workspace@example.invalid", hashPassword("Disposable workspace password"));
  const db = createProfileClient(p);
  const dir = mkdtempSync(path.join(tmpdir(), "it-assets-adoption-integration-"));
  const controlDir = path.join(dir, "control"), branding = path.join(dir, "branding");
  mkdirSync(branding);
  const key = randomBytes(32).toString("base64url"), secret = "Representative Entra secret";
  process.env.APP_SETTINGS_ENCRYPTION_KEY = key;
  const logo = "logo-12345678-1234-1234-1234-123456789012.png";
  const logoBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM00AAAAASUVORK5CYII=", "base64");
  writeFileSync(path.join(branding, logo), logoBytes);
  for (const [file, value] of [["url", connectionUrl(p).replace(/\?.*$/, "")], ["key", key], ["entra", secret]]) writeFileSync(path.join(dir, file), value, { mode: 0o600 });
  const env = { ...process.env, IT_ASSETS_CONTROL_DIR: controlDir, IT_ASSETS_ADOPT_DATABASE_URL_FILE: path.join(dir, "url"),
    IT_ASSETS_LEGACY_BRANDING_DIR: branding, APP_SETTINGS_ENCRYPTION_KEY: "", APP_SETTINGS_ENCRYPTION_KEY_FILE: path.join(dir, "key"),
    IT_ASSETS_ENTRA_SECRET_UPGRADE: "", IT_ASSETS_ENTRA_SECRET_UPGRADE_FILE: path.join(dir, "entra") };
  const invoke = (operation: string, confirm?: string, overrides = {}) => run(process.execPath,
    ["--import", "tsx", "scripts/adopt-legacy.mjs", operation, ...(confirm ? [confirm] : [])], { env: { ...env, ...overrides }, timeout: 120000, windowsHide: true });
  try {
    const user = await db.user.findFirstOrThrow();
    const category = await db.category.create({ data: { name: "Laptops", slug: "laptops" } });
    const location = await db.location.create({ data: { name: "Office", slug: "office" } });
    const label = await db.labelTemplate.create({ data: { name: "Fixture label", slug: "fixture-label", width: 50, height: 25 } });
    const asset = await db.asset.create({ data: { name: "Preserved laptop", assetTag: "UPGRADE-001", categoryId: category.id,
      assignedLocationId: location.id, assignedUserId: user.id, labelTemplateId: label.id } });
    await db.borrowedItem.create({ data: { assetId: asset.id, borrowerUserId: user.id, issuedByUserId: user.id, returnedByUserId: user.id,
      dueAt: new Date("2030-01-01"), returnedAt: new Date(), notes: "Preserved history" } });
    await db.auditLog.create({ data: { actorUserId: user.id, action: "CHECKOUT", entityType: "Asset", entityId: asset.id, summary: "Representative history" } });
    const credential = createIntegrationToken("deskmap");
    for (const [key, value] of Object.entries({ "app.title": "Existing production-like inventory", "branding.logo.light": "/branding/uploads/" + logo,
      "authentication.entra.enabled": "true", "authentication.entra.ssoEnabled": "true", "authentication.entra.tenantId": "tenant-fixture",
      "authentication.entra.clientId": "client-fixture", "authentication.entra.secretReference": secret,
      "authentication.entra.redirectUri": "https://fixture.invalid/api/auth/entra/callback", "authentication.entra.groupMappings": "[]",
      "mail.clientSecretEncrypted": encryptAppSettingSecret("Mail credential fixture"), "mail.enabled": "false",
      "integrations.deskmap.enabled": "true", "integrations.deskmap.tokenHash": credential.hash,
      "integrations.deskmap.expiresAt": "2030-01-01T00:00:00.000Z", "integrations.deskmap.scope": "assigned-assets:read",
      ["integrations.deskmap.grant.local." + user.id]: user.id,
      "permissions.role.ADMIN": JSON.stringify({ capabilities: { viewAssets: false } }) })) {
      await db.setting.upsert({ where: { key }, create: { category: key.split(".")[0], key, value }, update: { value } });
    }
    const snapshot = async () => {
      const result: Record<string, unknown> = {};
      for (const table of ["_prisma_migrations", ...Prisma.dmmf.datamodel.models.map(m => m.dbName ?? m.name)]) {
        const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>("SELECT * FROM `" + table + "`");
        result[table] = rows.map(row => JSON.stringify(row, (_, value) => typeof value === "bigint" ? value.toString() : value)).sort();
      }
      return result;
    };
    const before = await snapshot();
    const preflight = await invoke("check");
    assert.match(preflight.stdout, /Preflight passed/);
    assert.ok(!preflight.stdout.includes(secret) && !preflight.stdout.includes(password));
    await assert.rejects(invoke("adopt", "wrong-name"));
    await assert.rejects(invoke("check", undefined, { APP_SETTINGS_ENCRYPTION_KEY_FILE: path.join(dir, "entra") }));
    await assert.rejects(invoke("check", undefined, { IT_ASSETS_LEGACY_BRANDING_DIR: path.join(dir, "missing") }));
    assert.deepEqual(await snapshot(), before);
    await invoke("adopt", p.database);
    await invoke("adopt", p.database);
    let store = new ControlStore(controlDir);
    assert.equal(store.profiles().length, 1);
    assert.equal(store.state().active, null);
    assert.equal(store.profile(legacyProfileId).database, p.database);
    assert.deepEqual(readFileSync(path.join(controlDir, "workspaces", legacyProfileId, "branding", logo)), logoBytes);
    assert.throws(() => store.assertLegacyRuntime(legacyProfileId, "wrong", secret), /verified deployment secrets/);
    assert.throws(() => store.assertLegacyRuntime(legacyProfileId, key, ""), /verified deployment secrets/);
    store.assertLegacyRuntime(legacyProfileId, key, secret);
    store.activate(legacyProfileId, 0);
    process.env.IT_ASSETS_REVISION = "1";
    const auth = store.authentication() as { entraSecretReference: string; entraEnabled: boolean };
    assert.equal(auth.entraSecretReference, "IT_ASSETS_ENTRA_SECRET_UPGRADE");
    assert.equal(auth.entraEnabled, true);
    store.close(); store = new ControlStore(controlDir);
    assert.equal(store.state().active, legacyProfileId);
    await db.$disconnect(); // reconnect from the same saved credentials
    assert.deepEqual(await snapshot(), before);
    assert.equal(decryptAppSettingSecret((await db.setting.findUniqueOrThrow({ where: { key: "mail.clientSecretEncrypted" } })).value), "Mail credential fixture");
    assert.ok(matchesIntegrationToken(credential.token, (await db.setting.findUniqueOrThrow({ where: { key: "integrations.deskmap.tokenHash" } })).value));
    assert.equal((await db.setting.findUniqueOrThrow({ where: { key: "integrations.deskmap.grant.local." + user.id } })).value, user.id);
    store.activate(null, 1); // local selection rollback only, no inventory mutation
    store.close();
    assert.deepEqual(await snapshot(), before);
    const owner = new DatabaseSync(path.join(controlDir, "owner.sqlite"));
    owner.exec("BEGIN EXCLUSIVE");
    try { await assert.rejects(invoke("adopt", p.database)); } finally { owner.close(); }
    // A pending migration blocks adoption. Restore only this fixture history row afterward.
    const last = await db.$queryRawUnsafe<{ id: string; finished_at: Date }[]>("SELECT id,finished_at FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 1");
    await db.$executeRawUnsafe("UPDATE _prisma_migrations SET finished_at=NULL WHERE id=?", last[0].id);
    try { await assert.rejects(invoke("check")); }
    finally { await db.$executeRawUnsafe("UPDATE _prisma_migrations SET finished_at=? WHERE id=?", last[0].finished_at, last[0].id); }
    assert.deepEqual(await snapshot(), before);
    console.log("PASS: representative rows/settings, branding copy, encrypted credentials, failed preflight, idempotence, offline lock, reconnect, selection rollback and pending-migration rejection. Docker/image rollback and live Entra are separate acceptance checks.");
  } finally { await db.$disconnect(); }
});
