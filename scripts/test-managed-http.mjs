// Run after build:managed; owns port 4050 and a new temporary control directory.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "it-assets-http-")),
  base = "http://localhost:4050",
  url = base + "/setup",
  workspace = url + "/workspace";
const server = spawn(
  process.execPath,
  ["--import", "tsx", "scripts/managed-start.mjs"],
  {
    stdio: ["ignore", "pipe", "inherit", "ipc"],
    env: {
      ...process.env,
      IT_ASSETS_CONTROL_DIR: dir,
      IT_ASSETS_BIND: "127.0.0.1",
      IT_ASSETS_MANAGED_URL: base,
      DATABASE_URL: "mysql://must-not-be-used@127.0.0.1:1/disabled",
    },
  },
);
const exited = once(server, "exit");
let cookie = "";
async function page(target = cookie ? workspace : url) {
  const r = await fetch(target, { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  const html = await r.text();
  return html.replaceAll("<!-- -->", "");
}
async function post(op, values = {}) {
  const html = await page();
  const f = new FormData();
  const forms = html.match(/<form[\s\S]*?<\/form>/g) || [];
  const own =
    forms.find(
      (s) =>
        s.includes('name="op" value="' + op + '"') &&
        (!values.id || s.includes('name="id" value="' + values.id + '"')),
    ) ||
    forms.find(
      (s) => values.id && s.includes('name="id" value="' + values.id + '"'),
    ) ||
    forms[0];
  assert.ok(own);
  const decode = (s) =>
    s
      .replaceAll("&quot;", '"')
      .replaceAll("&amp;", "&")
      .replaceAll("&#x27;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">");
  for (const input of own.match(/<input[^>]*>/g) || []) {
    const name = input.match(/name="([^"]*)"/)?.[1],
      value = input.match(/value="([^"]*)"/)?.[1] ?? "";
    if (name) f.set(decode(name), decode(value));
  }
  f.set("op", op);
  f.set("context", "setup");
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  const r = await fetch(cookie ? workspace : url, {
    method: "POST",
    headers: { Origin: base, Cookie: cookie },
    body: f,
    redirect: "manual",
  });
  assert.ok(
    [200, 303].includes(r.status),
    `Unexpected action response ${r.status}`,
  );
  const c = r.headers
    .getSetCookie()
    .find((s) => s.startsWith("it_assets_management_visit="));
  if (c) {
    cookie = c.split(";")[0];
    if (c.includes("Max-Age=0")) cookie = "";
    else {
      assert.match(c, /HttpOnly/i);
      assert.match(c, /SameSite=strict/i);
      assert.match(c, /Path=\//);
    }
  }
  if (r.status === 303)
    return new URL(r.headers.get("location"), base).searchParams.get("message");
  const body = (await r.text()).replaceAll("<!-- -->", "");
  const alerts = [
    ...body.matchAll(/<p[^>]*role="alert"[^>]*>([\s\S]*?)<\/p>/g),
  ].map((m) => m[1]);
  assert.ok(alerts.length, "Expected a safe form error");
  return alerts.join(" ");
}
try {
  await Promise.race([
    new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(Error("Managed startup timed out")),
        60000,
      );
      deadline.unref();
      server.stdout.on("data", (d) => {
        if (String(d).includes("IT Assets ready at ")) {
          clearTimeout(deadline);
          resolve();
        }
      });
    }),
    exited.then(() => {
      throw Error("Test server could not acquire port 4050");
    }),
  ]);
  assert.equal(
    new URL(
      (await fetch(base, { redirect: "manual" })).headers.get("location"),
      base,
    ).pathname,
    "/setup",
  );
  const overview = await (await fetch(base + "/installation")).text();
  assert.match(overview, /First-run setup/);
  assert.match(overview, /Welcome &amp; Organization/);
  assert.match(overview, /without an external database/);
  assert.ok(!overview.includes('href="/assets/new"'));
  assert.equal(
    (
      await fetch(base + "/api/settings/import/assets", {
        method: "POST",
        headers: { "x-it-assets-revision": "0" },
      })
    ).status,
    409,
  );
  assert.equal(
    new URL(
      (await fetch(base + "/assets/new", { redirect: "manual" })).headers.get(
        "location",
      ),
      base,
    ).pathname,
    "/setup",
  );
  assert.ok((await page()).includes("Register administrator"));
  const creds = {
    email: "operator@example.invalid",
    password: "Disposable operator test password.",
  };
  assert.match(
    await post("enroll", {
      bootstrap: readFileSync(path.join(dir, "bootstrap-token"), "utf8").trim(),
      ...creds,
      confirmPassword: creds.password,
      siteName: "Fixture Organization",
      appTitle: "Fixture Assets",
    }),
    /registered/,
  );
  assert.match(await post("save", {}), /Sign in/);
  assert.match(await post("login", creds), /Signed in/);
  assert.match(await page(), /Back to IT Assets/);
  const firstSession = cookie;
  const entry = await fetch(url, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  assert.equal(entry.status, 200);
  assert.match(await entry.text(), /Local administrator sign-in/);
  const replay = await fetch(workspace, {
    headers: { Cookie: firstSession },
    redirect: "manual",
  });
  assert.equal(replay.status, 303);
  assert.match(replay.headers.get("cache-control"), /no-store/);
  cookie = "";
  assert.match(await post("login", creds), /Signed in/);
  const leaving = cookie;
  const outside = await fetch(base + "/setup", {
    headers: {
      Cookie: cookie + "; inventory_session=preserve-me",
      Accept: "text/html",
    },
  });
  assert.ok(
    outside.headers
      .getSetCookie()
      .every((c) => !c.startsWith("inventory_session=")),
  );
  assert.equal(
    (
      await fetch(base + "/settings/database-management/session", {
        headers: { Cookie: leaving },
      })
    ).status,
    401,
  );
  cookie = "";
  assert.match(await post("login", creds), /Signed in/);
  const offline = {
    name: "Offline SQL fixture",
    host: "127.0.0.1",
    port: "1",
    database: "it_assets_offline_test",
    username: "test",
    password: "offline-secret-only",
    provider: "sqlserver",
    revision: "0",
  };
  assert.match(await post("save", offline), /saved/);
  let html = await page();
  assert.ok(!html.includes(offline.password));
  const getId = (h) => h.match(/name="id" value="([a-f0-9-]{36})"/i)?.[1];
  const offlineId = getId(html);
  assert.ok(offlineId);
  const msg = await post("validate", { id: offlineId, revision: "0" });
  assert.ok(!msg.includes("Connected —"));
  assert.doesNotMatch(msg, /connection changed/i);
  assert.match(
    await post("remove", { id: offlineId, revision: "0" }),
    /removed/,
  );
  if (process.env.IT_ASSETS_HTTP_FIXTURE === "1") {
    const profile = {
      name: "HTTP inventory",
      host: "127.0.0.1",
      port: process.env.IT_ASSETS_TEST_MARIA_PORT || "43327",
      database:
        "it_assets_managed_" +
        (process.env.IT_ASSETS_TEST_RUN || "") +
        (process.env.IT_ASSETS_HTTP_INITIALIZE === "1" ? "c_test" : "a_test"),
      username: "it_assets_test",
      password: process.env.IT_ASSETS_TEST_PASSWORD,
      provider: "mariadb",
      revision: "0",
    };
    assert.match(profile.database, /^it_assets_managed_[a-z0-9]+_test$/);
    assert.ok(profile.password);
    assert.match(await post("save", profile), /saved/);
    html = await page();
    assert.ok(!html.includes(profile.password));
    const id = getId(html);
    assert.ok(id);
    assert.match(await post("validate", { id, revision: "0" }), /Connected/);
    if (process.env.IT_ASSETS_HTTP_INITIALIZE === "1") {
      const values = {
        id,
        revision: "0",
        confirm: profile.database,
        workspaceEmail: "workspace@example.invalid",
        workspacePassword: "Disposable workspace password",
        workspaceConfirmPassword: "Disposable workspace password",
      };
      assert.match(await post("initialize", values), /Schema and workspace/);
      assert.match(await post("initialize", values), /empty database/);
    }
    assert.match(
      await post("inspect", { id, revision: "0" }),
      /Connected — compatible/,
    );
    assert.match(
      await post("activate", { id, revision: "0", confirm: "wrong" }),
      /confirm/,
    );
    assert.match(
      await post("activate", { id, revision: "0", confirm: profile.database }),
      /Selection saved/,
    );
    let login;
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        login = await fetch(base + "/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-it-assets-revision": "1",
          },
          body: JSON.stringify({
            email: "workspace@example.invalid",
            password: "Disposable workspace password",
          }),
        });
        if (login.status === 200) break;
      } catch {}
    }
    assert.equal(login?.status, 200);
    const inventoryCookie = login.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const readiness = await fetch(base + "/setup/status", {
      headers: { Cookie: cookie },
    });
    assert.equal(readiness.status, 200);
    assert.equal((await readiness.json()).ready, true);
    assert.equal(
      (
        await fetch(base + "/dashboard", {
          headers: { Cookie: inventoryCookie },
          redirect: "manual",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/api/auth/login", {
          method: "POST",
          headers: { "x-it-assets-revision": "0" },
        })
      ).status,
      409,
    );
    assert.ok((await page()).includes("HTTP inventory · Active"));
  }
  assert.match(await post("logout"), /Signed out/);
  assert.match(await post("save", {}), /Sign in/);
  assert.match(
    await post("enroll", {
      bootstrap: "consumed",
      ...creds,
      confirmPassword: creds.password,
      siteName: "Fixture Organization",
      appTitle: "Fixture Assets",
    }),
    /closed/,
  );
  console.log(
    "PASS: offline setup shell, enrollment, fresh entry, server-side exit, cookie isolation, unauthorized requests, credential redaction, unreachable-SQL recovery" +
      (process.env.IT_ASSETS_HTTP_FIXTURE === "1"
        ? ", activation, restart, inventory sign-in and stale-write rejection"
        : ""),
  );
} finally {
  if (server.connected) server.send("stop");
  await exited;
}
