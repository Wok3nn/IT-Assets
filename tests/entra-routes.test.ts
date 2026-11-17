import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
for (const workspace of ["sql", "maria"]) test(`mocked Entra routes authorize only the ${workspace} workspace after switching`, () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "tests/fixtures/entra-routes.ts", workspace], {
    encoding: "utf8", windowsHide: true, env: { ...process.env, TSX_TSCONFIG_PATH: path.resolve("tests/tsconfig.json") }, timeout: 30000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
