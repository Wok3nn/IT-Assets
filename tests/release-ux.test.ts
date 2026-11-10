import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { enrollmentGuidance } from "../src/modules/database-management/enrollment-guidance";
import { EnrollmentHelp } from "../src/modules/database-management/enrollment-help";
import { DatabaseSummary } from "../src/modules/database-management/database-summary";
import { activationVerified } from "../src/modules/database-management/setup-state";
import { APP_VERSION, RELEASE_STATUS } from "../src/lib/app-metadata";

test("token help quotes the configured path without reading a secret", () => {
  const windows = enrollmentGuidance("C:\\Private O'Brien\\Control", "win32");
  assert.equal(windows.localCommand, "Get-Content -LiteralPath 'C:\\Private O''Brien\\Control\\bootstrap-token'");
  const linux = enrollmentGuidance("/srv/IT Assets/control", "linux");
  assert.equal(linux.localCommand, "cat -- '/srv/IT Assets/control/bootstrap-token'");
  assert.match(linux.dockerCommand, /IT_ASSETS_CONTROL_DIR/);
  const html = renderToStaticMarkup(createElement(EnrollmentHelp, { guidance: linux }));
  assert.match(html, /\/srv\/IT Assets\/control\/bootstrap-token/);
  assert.match(html, /consumes it once/);
});

test("activation success requires live verification of the exact profile and revision", () => {
  const result = { ready: true, verified: true, profile: "a", revision: 2, message: "Ready" };
  assert.ok(activationVerified(result, "a", 2));
  assert.ok(!activationVerified({ ...result, verified: false }, "a", 2));
  assert.ok(!activationVerified(result, "b", 2));
  assert.ok(!activationVerified(result, "a", 3));
  assert.ok(!activationVerified({ ready: true, message: "Ready" }, "a", 2));
});

test("preparation summarizes only the database target and selection state", () => {
  const html = renderToStaticMarkup(createElement(DatabaseSummary, {
    profile: { id: "fixture", version: "1", name: "Friendly name", provider: "mariadb", host: "database-service", database: "inventory_test", port: 3306, trustCertificate: false },
    active: true,
  }));
  for (const text of ["MariaDB", "database-service", "inventory_test", "3306", "Active selection"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /password|username|Friendly name/);
});

test("release metadata agrees across runtime and package manifests", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  assert.equal(APP_VERSION, "0.6.0");
  assert.equal(pkg.version, APP_VERSION);
  assert.equal(lock.version, APP_VERSION);
  assert.equal(lock.packages[""].version, APP_VERSION);
  assert.match(RELEASE_STATUS, /Pending production acceptance/);
});
