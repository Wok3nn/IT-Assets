import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ControlStore,
  profileSchema,
} from "../src/modules/database-management/control-store";
import {
  isReady,
  runtimeMatches,
} from "../src/modules/database-management/setup-state";
import { schemaFingerprint } from "../src/modules/database-management/setup-service";

test("organization enrollment is atomic, permanent, versioned and independent of inventory", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "it-assets-unified-"));
  let s = new ControlStore(dir);
  const bootstrap = readFileSync(path.join(dir, "bootstrap-token"), "utf8");
  const org = { siteName: "Example Organization", appTitle: "Example Assets" };
  assert.throws(() =>
    s.enroll(bootstrap, "admin@example.invalid", "A disposable test password", {
      ...org,
      siteName: "",
    }),
  );
  assert.equal(s.registered(), false);
  assert.equal(s.organization(), null);
  s.enroll(
    bootstrap,
    "admin@example.invalid",
    "A disposable test password",
    org,
  );
  assert.equal(existsSync(path.join(dir, "bootstrap-token")), false);
  assert.equal(s.state().active, null);
  assert.throws(() => s.saveOrganization(org, "stale"));
  const version = s.organization()!.version;
  s.saveOrganization({ ...org, appTitle: "Changed locally" }, version);
  s.close();
  s = new ControlStore(dir);
  try {
    assert.equal(s.organization()?.appTitle, "Changed locally");
    assert.throws(
      () =>
        s.enroll(
          bootstrap,
          "admin@example.invalid",
          "A disposable test password",
          org,
        ),
      /closed/,
    );
    assert.ok(
      s.authorized(
        s.login("admin@example.invalid", "A disposable test password"),
      ),
    );
    assert.equal(s.state().active, null);
  } finally {
    s.close();
  }
});

test("profile evidence and readiness are bound to exact version, revision and runtime generation", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "it-assets-progress-"));
  const s = new ControlStore(dir);
  try {
    const profile = profileSchema.parse({
      name: "Disposable",
      provider: "sqlserver",
      host: "127.0.0.1",
      port: 1,
      database: "isolated_test",
      username: "fixture",
      password: "never-connected",
    });
    const id = s.save(profile),
      version = s.profiles()[0].version,
      fingerprint = schemaFingerprint("sqlserver");
    assert.match(fingerprint, /^[a-f0-9]{64}$/);
    s.recordInspection(id, {
      version,
      fingerprint,
      status: "compatible",
      checkedAt: Date.now(),
      workspace: "existing",
    });
    s.activate(id, 0);
    const runtime = {
      generation: "one",
      active: id,
      revision: 1,
      heartbeat: Date.now(),
      listening: true,
    };
    s.setRuntime(runtime);
    const ready = {
      generation: "one",
      profile: id,
      revision: 1,
      version,
      fingerprint,
      checkedAt: Date.now(),
    };
    s.markReady(ready);
    assert.ok(isReady(s.readiness(), runtime, s.state(), version, fingerprint));
    assert.equal(
      isReady(
        ready,
        { ...runtime, generation: "two" },
        s.state(),
        version,
        fingerprint,
      ),
      false,
    );
    assert.equal(
      isReady(ready, runtime, s.state(), "edited", fingerprint),
      false,
    );
    assert.equal(
      isReady(ready, runtime, s.state(), version, "new-schema"),
      false,
    );
    assert.equal(runtimeMatches(runtime, s.state(), Date.now() + 10001), false);
    assert.equal(
      runtimeMatches({ ...runtime, listening: false }, s.state()),
      false,
    );
    s.recordInspection(id, {
      version,
      fingerprint,
      status: "failed",
      checkedAt: Date.now(),
      workspace: null,
    });
    assert.equal(s.readiness(), null);
    assert.throws(() => s.markReady(ready), /compatible/);
    s.activate(null, 1);
    s.save({ ...profile, name: "Edited" }, id);
    assert.equal(s.inspection(id), null);
    assert.throws(
      () =>
        s.recordInspection(id, {
          version,
          fingerprint,
          status: "empty",
          checkedAt: Date.now(),
          workspace: null,
        }),
      /changed/,
    );
  } finally {
    s.close();
  }
});

test("existing managed state upgrades without re-enrollment or selection changes", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "it-assets-upgrade-"));
  let s = new ControlStore(dir);
  s.enroll(
    readFileSync(path.join(dir, "bootstrap-token"), "utf8"),
    "old@example.invalid",
    "Existing fixture password",
  );
  const token = s.login("old@example.invalid", "Existing fixture password");
  const p = profileSchema.parse({
    name: "Existing fixture",
    provider: "mariadb",
    host: "127.0.0.1",
    port: 1,
    database: "isolated_test",
    username: "fixture",
    password: "never-connected",
  });
  const id = s.save(p);
  s.activate(id, 0);
  s.close();
  // Model the pre-upgrade control schema; preserve every existing identity and
  // encrypted profile while the new table is installed on the next startup.
  const { DatabaseSync } = process.getBuiltinModule(
    "node:sqlite",
  ) as typeof import("node:sqlite");
  const old = new DatabaseSync(path.join(dir, "control.sqlite"));
  old.exec("DROP TABLE setup_record");
  old.close();
  s = new ControlStore(dir);
  try {
    assert.ok(s.registered());
    assert.ok(s.authorized(token));
    assert.equal(s.organization(), null);
    assert.deepEqual({ ...s.state() }, { revision: 1, active: id });
    assert.deepEqual(s.profile(id), p);
  } finally {
    s.close();
  }
});
