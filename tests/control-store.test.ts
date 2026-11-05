import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ControlStore,
  profileSchema,
} from "../src/modules/database-management/control-store";
import { connectionUrl } from "../src/modules/database-management/profile-client";

test("offline enrollment, session persistence, encrypted profiles and revision fencing", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "it-assets-control-"));
  const file = path.join(dir, "bootstrap-token");
  let s = new ControlStore(dir);
  const token = readFileSync(file, "utf8"),
    email = "operator@example.invalid",
    password = "a fixture password only";
  assert.throws(() => s.enroll("wrong", email, password));
  s.enroll(token, email, password);
  assert.equal(existsSync(file), false);
  assert.throws(() => s.enroll(token, email, password));
  assert.throws(() => s.login(email, "wrong"));
  const session = s.login(email, password);
  const p = profileSchema.parse({
    provider: "sqlserver",
    database: "disposable",
    name: "Test",
    host: "localhost",
    port: 1433,
    username: "test",
    password: "unique:secret;do-not-log",
  });
  assert.match(
    connectionUrl(p),
    /password=\{unique:secret;do-not-log\};encrypt=true;trustServerCertificate=false/,
  );
  assert.throws(() =>
    profileSchema.parse({ ...p, host: "server;encrypt=false" }),
  );
  assert.throws(() => profileSchema.parse({ ...p, database: "master" }));
  const id = s.save(p);
  assert.ok(!("username" in s.profiles()[0]));
  assert.ok(!JSON.stringify(s.profiles()).includes(p.password));
  await s.exclusive(async () => {
    await assert.rejects(s.exclusive(async () => null));
  });
  s.activate(id, 0);
  process.env.IT_ASSETS_REVISION = "1";
  assert.throws(() =>
    s.saveAuthentication({ entraSecretReference: "plaintext-value" }),
  );
  s.saveAuthentication({ entraSecretReference: "IT_ASSETS_ENTRA_SECRET_TEST" });
  assert.deepEqual(s.authentication(), {
    entraSecretReference: "IT_ASSETS_ENTRA_SECRET_TEST",
  });
  assert.throws(() => s.remove(id));
  assert.throws(() => s.save(p, id));
  assert.throws(() => s.activate(null, 0));
  s.close();
  assert.equal(
    readFileSync(path.join(dir, "control.sqlite")).includes(
      Buffer.from(p.password),
    ),
    false,
  );
  s = new ControlStore(dir);
  assert.ok(s.authorized(session));
  assert.deepEqual(s.profile(id), p);
  s.activate(null, 1);
  s.remove(id);
  s.logout(session);
  assert.equal(s.authorized(session), false);
  assert.ok(s.activity().some((e) => e.action === "profile activated"));
  s.close();
});
