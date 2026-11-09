import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  databaseDiagnostic,
  logDatabaseFailure,
} from "../src/modules/database-management/diagnostics";
import { connectionUrl } from "../src/modules/database-management/profile-client";
import type { Profile } from "../src/modules/database-management/control-store";

const profile: Profile = {
  name: "PRIVATE-PROFILE-NAME",
  provider: "sqlserver",
  host: "localhost",
  port: 1433,
  database: "IT-Assets_DEV",
  username: "PRIVATE-LOGIN",
  password: "PRIVATE-SECRET;with punctuation",
  trustCertificate: true,
};

test("SQL Server schema and Prisma 6 migration lock use their distinct connector names", () => {
  assert.match(
    readFileSync("prisma/providers/sqlserver/schema.prisma", "utf8"),
    /provider\s*=\s*"sqlserver"/,
  );
  assert.match(
    readFileSync(
      "prisma/managed-migrations/sqlserver/migration_lock.toml",
      "utf8",
    ),
    /^provider\s*=\s*"mssql"\s*$/m,
  );
  assert.match(connectionUrl(profile), /;database=\{IT-Assets_DEV\};/);
  assert.match(
    connectionUrl(profile),
    /;password=\{PRIVATE-SECRET;with punctuation\};encrypt=true;/,
  );
});

test("CLI diagnostics extract actionable provider and migration errors without free-form output", () => {
  const error = {
    code: 1,
    stderr: `P3019 datasource provider mssql differs from sqlserver. ${connectionUrl(profile)}\nP3018 Migration 20261105000000_inventory Database error code: 1934\n${profile.password}`,
    stdout: profile.username,
    message: profile.name,
    stack: "PRIVATE-STACK",
  };
  const result = databaseDiagnostic(error, "migrate-deploy", profile);
  assert.deepEqual(result.codes, ["P3019", "P3018"]);
  assert.deepEqual(result.providerNames, ["mssql", "sqlserver"]);
  assert.deepEqual(result.databaseCodes, ["1934"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.migration, "20261105000000_inventory");
  assert.ok(result.hints.some((h) => h.includes("SET options")));
  const text = JSON.stringify(result);
  for (const privateValue of [
    profile.password,
    profile.username,
    profile.name,
    connectionUrl(profile),
    "PRIVATE-STACK",
  ])
    assert.ok(!text.includes(privateValue));
});

test("raw SQL codes, process failures and timeouts retain safe diagnostic context", () => {
  assert.deepEqual(
    databaseDiagnostic(
      { code: "P2010", meta: { code: "156", message: profile.password } },
      "permissions",
      profile,
    ).databaseCodes,
    ["156"],
  );
  assert.deepEqual(
    databaseDiagnostic(
      { code: "ENOENT", path: profile.password },
      "migrate-deploy",
      profile,
    ).codes,
    ["ENOENT"],
  );
  const timeout = databaseDiagnostic(
    { killed: true, signal: "SIGTERM", cmd: profile.password },
    "migrate-deploy",
    profile,
  );
  assert.equal(timeout.killed, true);
  assert.equal(timeout.signal, "SIGTERM");
  assert.ok(!JSON.stringify(timeout).includes(profile.password));
});

test("nested service catches log a failure once at its original stage", (t) => {
  const spy = t.mock.method(console, "error", () => {});
  const error = new Error(`P3019 ${profile.password}`);
  logDatabaseFailure(error, "migrate-deploy", profile);
  logDatabaseFailure(error, "inspect", profile);
  assert.equal(spy.mock.callCount(), 1);
  const result = JSON.parse(spy.mock.calls[0].arguments[1]);
  assert.equal(result.stage, "migrate-deploy");
  assert.ok(!spy.mock.calls[0].arguments[1].includes(profile.password));
});
