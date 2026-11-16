import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { migrationChecksumMatches } from "../src/modules/database-management/migration-checksum";
const name = "20261105000000_inventory";
const sql = readFileSync(`prisma/managed-migrations/sqlserver/${name}/migration.sql`, "utf8").replace(/\r\n/g, "\n");
const historical = "c6b8c50026d1be6eded4166c8c668ca5ff115789d4677f5e982c0f8ddca199a5";
test("verified historical mixed-newline SQL migration works from Linux and Windows checkouts", () => {
  for (const source of [sql, sql.replace(/\n/g, "\r\n")]) {
    for (const bytes of [sql, sql.replace(/\n/g, "\r\n")])
      assert.ok(migrationChecksumMatches("sqlserver", name, source, createHash("sha256").update(bytes).digest("hex")));
    assert.ok(migrationChecksumMatches("sqlserver", name, source, historical));
  }
});
test("historical alias cannot authorize changed SQL, another migration/provider or arbitrary checksum", () => {
  assert.ok(!migrationChecksumMatches("sqlserver", name, sql + "\nSELECT 1;", historical));
  assert.ok(!migrationChecksumMatches("mariadb", name, sql, historical));
  assert.ok(!migrationChecksumMatches("sqlserver", "different", sql, historical));
  assert.ok(!migrationChecksumMatches("sqlserver", name, sql, "0".repeat(64)));
});
