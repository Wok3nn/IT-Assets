import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("managed image normalizes all copied assets before restoring only runtime write ownership", () => {
  const dockerfile = readFileSync("docker/managed.Dockerfile", "utf8");
  const normalize = dockerfile.indexOf("chown -R root:root /app && chmod -R a=rX,u+w /app");
  assert.ok(normalize > dockerfile.lastIndexOf("COPY --from=build"));
  const writable = dockerfile.indexOf("chown -R node:node /data/control /app/.next-managed");
  assert.ok(writable > normalize);
  assert.match(dockerfile, /chmod 700 \/data\/control/);
  assert.ok(dockerfile.indexOf("USER node") > writable);
  assert.ok(dockerfile.indexOf("RUN node scripts/check-managed-image-permissions.mjs") > dockerfile.indexOf("USER node"));
  assert.equal(dockerfile.match(/^USER .+$/gm)?.at(-1), "USER node");
});

test("image mode normalization repairs restrictive checkout modes without making code writable or data executable", { skip: process.platform === "win32" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "managed-permissions-"));
  try {
    const source = path.join(root, "src");
    mkdirSync(source);
    writeFileSync(path.join(source, "control-store.ts"), "fixture");
    chmodSync(path.join(source, "control-store.ts"), 0o600);
    writeFileSync(path.join(source, "engine"), "fixture");
    chmodSync(path.join(source, "engine"), 0o700);
    chmodSync(source, 0o700);
    const result = spawnSync("chmod", ["-R", "a=rX,u+w", root]);
    assert.equal(result.status, 0, result.stderr?.toString());
    assert.equal(statSync(source).mode & 0o777, 0o755);
    assert.equal(statSync(path.join(source, "control-store.ts")).mode & 0o777, 0o644);
    assert.equal(statSync(path.join(source, "engine")).mode & 0o777, 0o755);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
