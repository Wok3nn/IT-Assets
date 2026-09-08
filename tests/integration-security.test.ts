import assert from "node:assert/strict";
import test from "node:test";
import { canManageIntegrations, identitySchema } from "../src/modules/integrations/integrations.shared";
import { createIntegrationLimiter, createIntegrationToken, hashIntegrationToken, identityKey, matchesIntegrationToken, parseIntegrationAuthorization } from "../src/modules/integrations/integration-security";

test("integration credentials are random, hashed and strictly bearer-only", () => {
  const first = createIntegrationToken("deskmap");
  const second = createIntegrationToken("deskmap");
  assert.notEqual(first.token, second.token);
  assert.equal(first.hash, hashIntegrationToken(first.token));
  assert.equal(matchesIntegrationToken(first.token, first.hash), true);
  assert.equal(matchesIntegrationToken(first.token, second.hash), false);
  assert.equal(matchesIntegrationToken(first.token, "broken"), false);
  assert.equal(matchesIntegrationToken(first.token, undefined), false);
  assert.deepEqual(parseIntegrationAuthorization(`Bearer ${first.token}`), { id: "deskmap", token: first.token });
  for (const value of [null, first.token, `Basic ${first.token}`, `Bearer ${first.token} extra`, "Bearer iat_unknown_" + "a".repeat(43)]) {
    assert.equal(parseIntegrationAuthorization(value), null);
  }
});

test("tenant-qualified identity is normalized and has no email fallback", () => {
  const identity = identitySchema.parse({ type: "entra", tenantId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA", id: "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB" });
  assert.equal(identityKey(identity), "entra.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal(identitySchema.safeParse({ type: "entra", id: "person@example.com" }).success, false);
  assert.equal(identitySchema.safeParse({ type: "email", id: "person@example.com" }).success, false);
});

test("integration administration requires an active super-admin and both capabilities", () => {
  const full = { isActive: true, roleKeys: ["SUPER_ADMIN"], capabilities: { viewSettings: true, managePermissions: true } };
  assert.equal(canManageIntegrations(full), true);
  assert.equal(canManageIntegrations({ ...full, isActive: false }), false);
  for (const roleKeys of [[], ["ADMIN"], ["MANAGER"], ["VIEWER"]]) assert.equal(canManageIntegrations({ ...full, roleKeys }), false);
  assert.equal(canManageIntegrations({ ...full, capabilities: { viewSettings: false, managePermissions: true } }), false);
  assert.equal(canManageIntegrations({ ...full, capabilities: { viewSettings: true, managePermissions: false } }), false);
});

test("rate limits reject excess calls and reset at the fixed window boundary", () => {
  const limit = createIntegrationLimiter();
  for (let index = 0; index < 60; index++) assert.equal(limit("deskmap", 0).allowed, true);
  assert.deepEqual(limit("deskmap", 1000), { allowed: false, retryAfter: 59 });
  assert.equal(limit("anonymous", 1000).allowed, true);
  assert.equal(limit("deskmap", 60000).allowed, true);
});
