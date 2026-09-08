import assert from "node:assert/strict";
import test from "node:test";
import { buildTreeLabel } from "../src/lib/tree-label";
import { resolveMakeModelSource } from "../src/modules/assets/make-model-source";
import { getBorrowedItemCalendarStatus, getDaysBetweenCalendarDates } from "../src/modules/borrowed-items/borrowed-items-calendar";
import { buildDisabledLocalPasswordHash, hashPassword, verifyPassword } from "../src/services/password";

test("tree labels preserve paths, missing-node behavior, and terminate on cycles", () => {
  const items = [{ id: "a", name: "Root", parentId: null }, { id: "b", name: "Child", parentId: "a" }];
  assert.equal(buildTreeLabel(items, "b"), "Root / Child");
  assert.equal(buildTreeLabel(items, "a"), "Root");
  assert.equal(buildTreeLabel(items, "missing"), "");
  assert.equal(buildTreeLabel(items, null), null);
  assert.equal(buildTreeLabel([{ id: "a", name: "Root", parentId: "a" }], "a"), "Root");
});

test("make/model source uses exact depth and clears unavailable levels", () => {
  const path = [{ name: "Laptops" }, { name: "Dell" }, { name: "Latitude" }];
  assert.equal(resolveMakeModelSource(path, "subCategory1"), "Dell");
  assert.equal(resolveMakeModelSource(path, "subCategory2"), "Latitude");
  assert.equal(resolveMakeModelSource(path, "subCategory5"), "");
});

test("borrowed calendar uses business timezone and calendar days across DST", () => {
  const now = new Date("2026-03-09T02:00:00Z");
  const dueAt = new Date("2026-03-08T16:00:00Z");
  assert.equal(getBorrowedItemCalendarStatus({ dueAt, returnedAt: null }, now, "America/Toronto"), "Due Today");
  assert.equal(getBorrowedItemCalendarStatus({ dueAt, returnedAt: now }, now, "UTC"), "Returned");
  assert.equal(getDaysBetweenCalendarDates("2026-03-07", "2026-03-09"), 2);
});

test("local passwords verify without enabling SSO-only passwords", () => {
  const hash = hashPassword("test-password");
  assert.equal(verifyPassword("test-password", hash), true);
  assert.equal(verifyPassword("incorrect", hash), false);
  assert.equal(verifyPassword("test-password", buildDisabledLocalPasswordHash()), false);
  assert.equal(verifyPassword("test-password", "malformed"), false);
});
