import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertScriptDatabaseSelection } from "../scripts/database-selection.mjs";
import { loadProjectEnv } from "../scripts/load-env.mjs";

test("script selection defaults to MariaDB and rejects invalid combinations", () => {
  assert.equal(assertScriptDatabaseSelection({ env: {} }).provider, "mariadb");
  const selection = assertScriptDatabaseSelection({ env: { DB_MODE: "local", DB_PROVIDER: "sqlite" } });
  assert.match(selection.schemaPath, /sqlite[/\\]schema.prisma$/);
  assert.match(selection.providerMigrationsPath, /migrations[/\\]sqlite$/);
  assert.throws(() => assertScriptDatabaseSelection({ env: { DB_MODE: "external", DB_PROVIDER: "mariadb" } }), /Invalid database/);
  assert.throws(() => assertScriptDatabaseSelection({ env: { DB_PROVIDER: "unknown" } }), /Invalid DB_PROVIDER/);
});

test("Prisma environment loader preserves explicit process overrides", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "it-assets-env-test-"));
  const envFile = path.join(directory, ".env");
  const before = process.env.IT_ASSETS_ENV_TEST_VALUE;
  try {
    writeFileSync(envFile, '# comment\nIT_ASSETS_ENV_TEST_VALUE="from-file"\n');
    delete process.env.IT_ASSETS_ENV_TEST_VALUE;
    loadProjectEnv(directory);
    assert.equal(process.env.IT_ASSETS_ENV_TEST_VALUE, "from-file");
    process.env.IT_ASSETS_ENV_TEST_VALUE = "explicit";
    loadProjectEnv(directory);
    assert.equal(process.env.IT_ASSETS_ENV_TEST_VALUE, "explicit");
  } finally {
    if (before === undefined) delete process.env.IT_ASSETS_ENV_TEST_VALUE;
    else process.env.IT_ASSETS_ENV_TEST_VALUE = before;
    unlinkSync(envFile);
    rmdirSync(directory);
  }
});
