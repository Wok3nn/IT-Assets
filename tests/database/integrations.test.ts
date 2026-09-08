import assert from "node:assert/strict";
import test from "node:test";
import { db } from "../../src/services/database";
import { configureIntegration, listIntegrationOverviews } from "../../src/modules/integrations/integrations.service";
import { handleAssignedAssetsRequest } from "../../src/modules/integrations/integrations.api";
import { checkInAsset, checkOutAsset, listAssetsAssignedToUser } from "../../src/modules/assets/asset.service";
import { createBorrowedItem, markBorrowedItemReturned } from "../../src/modules/borrowed-items/borrowed-items.service";

// Never load .env here. Running this suite requires an explicit disposable URL.
const databaseUrl = process.env.DATABASE_URL ?? "";
const isDisposableSqlite = process.env.DB_PROVIDER === "sqlite" && /^file:.*[/\\]\.audit-runtime[/\\][^/\\]+\.db$/.test(databaseUrl);
let isDisposableMariaDb = false;
try {
  const url = new URL(databaseUrl);
  isDisposableMariaDb = process.env.DB_PROVIDER === "mariadb" && url.protocol === "mysql:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname) && /^\/it_assets_[a-z0-9_]+_test$/.test(url.pathname);
} catch { /* SQLite URLs are checked separately. */ }
if (!isDisposableSqlite && !isDisposableMariaDb) throw new Error("Tests require an explicit disposable .audit-runtime SQLite URL or loopback it_assets_*_test MariaDB database.");

test("database-backed integration lifecycle and existing assignment/loan workflows", async (t) => {
  t.after(async () => { await db.$disconnect(); });
  // Any accidental external service invocation fails the suite before sending.
  t.mock.method(globalThis, "fetch", async () => { throw new Error("External services are forbidden in database tests."); });
  const suffix = Date.now();
  const user = await db.user.create({ data: { name: "Audit approved user", email: `approved-${suffix}@example.invalid`, passwordHash: "disabled", canLogin: false } });
  const other = await db.user.create({ data: { name: "Audit other user", email: `other-${suffix}@example.invalid`, passwordHash: "disabled", canLogin: false } });
  await db.setupState.create({ data: { isCompleted: true } });
  const status = await db.assetStatus.upsert({ where: { key: "IN_STOCK" }, update: {}, create: { key: "IN_STOCK", name: "In Stock" } });
  await db.assetStatus.upsert({ where: { key: "ASSIGNED" }, update: {}, create: { key: "ASSIGNED", name: "Assigned" } });
  const asset = await db.asset.create({ data: { name: "Test laptop", assetTag: `audit-${suffix}`, statusId: status.id, notes: "PRIVATE", serialNumber: "PRIVATE-SERIAL" } });
  const second = await db.asset.create({ data: { name: "Test monitor", assetTag: `audit-monitor-${suffix}`, assignedUserId: user.id } });
  await db.asset.create({ data: { name: "Other user's asset", assetTag: `audit-other-${suffix}`, assignedUserId: other.id } });
  const request = (token: string | null, query = `type=local&id=${user.id}`) => handleAssignedAssetsRequest(new Request(`http://localhost/api/integrations/v1/assigned-assets?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }));
  const configure = (operation: string, extra = {}) => configureIntegration({ id: "deskmap", operation, actorUserId: user.id, ...extra });
  await configure("revoke");
  assert.equal((await listIntegrationOverviews())[0].status, "Not configured");
  assert.equal((await request(null)).status, 401);
  await assert.rejects(configure("enable"), /credential/);
  const token = (await configure("rotate"))!;
  assert.equal((await request(token)).status, 403);
  await assert.rejects(configure("grant", { identity: { type: "local", id: other.id }, userId: user.id }), /match/);
  await configure("grant", { identity: { type: "local", id: user.id }, userId: user.id });
  await configure("enable");
  assert.equal((await listIntegrationOverviews())[0].status, "Awaiting first request");
  await db.setting.update({ where: { key: "integrations.deskmap.scope" }, data: { value: "unapproved-scope" } });
  assert.equal((await request(token)).status, 403);
  await db.setting.update({ where: { key: "integrations.deskmap.scope" }, data: { value: "assigned-assets:read" } });
  const setup = await db.setupState.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  await db.setupState.update({ where: { id: setup.id }, data: { isCompleted: false } });
  try {
    assert.equal((await request(token)).status, 503);
  } finally {
    await db.setupState.update({ where: { id: setup.id }, data: { isCompleted: setup.isCompleted } });
  }
  const temporary = await db.user.create({ data: { name: "Empty mapped user", email: `empty-${suffix}@example.invalid`, passwordHash: "disabled", canLogin: false } });
  await configure("grant", { identity: { type: "local", id: temporary.id }, userId: temporary.id });
  const empty = await request(token, `type=local&id=${temporary.id}`);
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).assets, []);
  await db.user.delete({ where: { id: temporary.id } });
  assert.equal((await request(token, `type=local&id=${temporary.id}`)).status, 404);
  await configure("remove-grant", { grantKey: `grant.local.${temporary.id}` });
  await checkOutAsset({ assetId: asset.id, assignedUserId: user.id, actorUserId: user.id, notes: "Test checkout" });
  await assert.rejects(checkOutAsset({ assetId: asset.id, assignedUserId: other.id, actorUserId: user.id }), /no longer available/);
  const response = await request(token, `type=local&id=${user.id}&limit=1`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const first = await response.json();
  assert.equal(first.assets.length, 1);
  assert.deepEqual(Object.keys(first.assets[0]).sort(), ["assetTag", "id", "make", "model", "name", "status"]);
  const next = await (await request(token, `type=local&id=${user.id}&limit=1&after=${first.nextCursor}`)).json();
  assert.equal(next.assets.length, 1);
  assert.notEqual(first.assets[0].id, next.assets[0].id);
  assert.equal(next.nextCursor, null);
  assert.equal((await request(token, `type=local&id=${other.id}`)).status, 404);
  for (const query of [`type=local&id=${user.id}&limit=101`, `type=local&id=${user.id}&extra=true`, `type=local&id=${user.id}&id=${user.id}`, `type=email&id=test@example.com`]) {
    assert.equal((await request(token, query)).status, 400);
  }
  const entraIdentity = { type: "entra", tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
  await configure("grant", { identity: entraIdentity, userId: user.id });
  assert.equal((await request(token, `type=entra&tenantId=${entraIdentity.tenantId}&id=${entraIdentity.id}`)).status, 200);
  assert.equal((await request(token, `type=entra&tenantId=cccccccc-cccc-4ccc-8ccc-cccccccccccc&id=${entraIdentity.id}`)).status, 404);
  await db.user.update({ where: { id: user.id }, data: { isActive: false } });
  assert.equal((await request(token)).status, 404);
  await db.user.update({ where: { id: user.id }, data: { isActive: true } });
  await configure("remove-grant", { grantKey: `grant.local.${user.id}` });
  assert.equal((await request(token)).status, 404);
  await configure("grant", { identity: { type: "local", id: user.id }, userId: user.id });
  await configure("disable");
  assert.equal((await request(token)).status, 403);
  const rotated = (await configure("rotate"))!;
  assert.equal((await request(token)).status, 401);
  await configure("enable");
  await checkInAsset({ assetId: asset.id, actorUserId: user.id, notes: "Test return" });
  assert.deepEqual((await listAssetsAssignedToUser(user.id)).map((item) => item.id), [second.id]);
  const loan = await createBorrowedItem({ itemType: "asset", assetId: asset.id, borrowerUserId: user.id, actorUserId: user.id, dueAt: "2030-01-01" });
  await assert.rejects(checkOutAsset({ assetId: asset.id, assignedUserId: user.id }), /borrow|available/);
  const duringLoan = await (await request(rotated)).json();
  assert.deepEqual(duringLoan.assets.map((item: { id: string }) => item.id), [second.id]);
  await markBorrowedItemReturned({ borrowedItemId: loan.id, actorUserId: user.id, returnedAt: new Date().toISOString() });
  const guest = await db.guestProfile.create({ data: { displayName: "Audit guest" } });
  await checkOutAsset({ assetId: asset.id, assignee: { type: "guest-profile", id: guest.id }, actorUserId: user.id });
  assert.deepEqual((await (await request(rotated)).json()).assets.map((item: { id: string }) => item.id), [second.id]);
  await db.setting.update({ where: { key: "integrations.deskmap.expiresAt" }, data: { value: "2000-01-01T00:00:00Z" } });
  assert.equal((await request(rotated)).status, 401);
  await configure("revoke");
  assert.equal((await request(rotated)).status, 401);
  const audit = await db.auditLog.findMany({ where: { entityType: "Integration" } });
  assert.ok(audit.some((entry) => entry.action === "integration.assigned-assets.read"));
  assert.ok(!JSON.stringify(audit).includes(token));
  assert.ok(!JSON.stringify(await listIntegrationOverviews()).includes(rotated));
  assert.ok((await db.auditLog.count({ where: { entityId: asset.id, action: "asset.checked_out" } })) >= 2);
});
