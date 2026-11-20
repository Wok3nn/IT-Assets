// Run after build:managed; owns port 4050 and a new temporary control directory.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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
let cookie = "", inventoryCookie = "";
const cookies = () => [cookie, inventoryCookie].filter(Boolean).join("; ");
async function page(target = cookie ? workspace : url) {
  const r = await fetch(target, { headers: { Cookie: cookies() } });
  assert.equal(r.status, 200);
  const html = await r.text();
  return html.replaceAll("<!-- -->", "");
}
async function post(op, values = {}, context = "setup") {
  const actionUrl = context === "management" ? base + "/settings/database-management" + (cookie ? "/workspace" : "") : cookie ? workspace : url;
  const html = await page(actionUrl);
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
    if (input.includes('type="checkbox"') && !input.includes('checked=""')) continue;
    const name = input.match(/name="([^"]*)"/)?.[1],
      value = input.match(/value="([^"]*)"/)?.[1] ?? "";
    // Approval tests supply this explicitly, including omission to test rejection.
    if (name && name !== "confirmation") f.set(decode(name), decode(value));
  }
  f.set("op", op);
  f.set("context", context);
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  const r = await fetch(actionUrl, {
    method: "POST",
    headers: { Origin: base, Cookie: cookies() },
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
  assert.match(overview, /Get-Content -LiteralPath/);
  assert.ok(!overview.includes(readFileSync(path.join(dir, "bootstrap-token"), "utf8").trim()));
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
  assert.match(await page(), /Sign out of setup/);
  const integrated = await page(workspace + "?step=3&settings=1");
  assert.match(integrated, /id="existing-database-settings" open=""/);
  for (const title of ["Import existing settings", "Appearance &amp; session", "Microsoft Entra sign-in", "Email settings", "Timezone"]) assert.ok(integrated.includes(title));
  assert.doesNotMatch(integrated, /Defer setup and manage|Type ENABLE/);
  assert.match(await post("presentation-enable"), /Confirm that you want/);
  assert.match(await post("presentation-enable", { confirmation: "ENABLE" }), /enabled/);
  const enabledHtml = await page(workspace + "?step=3&settings=1");
  const presentationForm = enabledHtml.match(/<form[\s\S]*?<\/form>/g).find(form => form.includes('name="op" value="presentation-save"'));
  const firstVersion = presentationForm.match(/name="version" value="([^"]+)"/)[1];
  assert.match(await post("presentation-save", { appTitle: "Fixture Assets", sessionTimeoutMinutes: "20" }), /saved/);
  assert.match(await post("presentation-save", { version: firstVersion, appTitle: "Must not replace", sessionTimeoutMinutes: "25" }), /changed|Reload/i);
  assert.doesNotMatch(await page(), /value="Must not replace"/);
  const adminStep = await page(workspace + "?step=2");
  assert.match(adminStep, /Installation administrator created/);
  assert.match(adminStep, /operator@example.invalid/);
  assert.doesNotMatch(adminStep, /Register administrator/);
  const managementEntry = await page(base + "/settings/database-management");
  assert.doesNotMatch(managementEntry, /First-run setup<\/p>|href="\/settings"/);
  assert.match(managementEntry, /Installation administrator sign-in/);
  cookie = "";
  assert.match(await post("login", creds), /Signed in/);
  assert.doesNotMatch(await page(), /Continue to workspace preparation/);
  assert.equal(new URL((await fetch(workspace + "?step=5", { headers: { Cookie: cookie }, redirect: "manual" })).headers.get("location"), base).searchParams.get("step"), "3");
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
  assert.doesNotMatch(html, /<details[^>]*open=""[^>]*>\s*<summary[^>]*>Add a connection/);
  assert.ok(!html.includes(offline.password));
  const getId = (h) => h.match(/name="id" value="([a-f0-9-]{36})"/i)?.[1];
  const offlineId = getId(html);
  assert.ok(offlineId);
  const capture = spawnSync(process.execPath, ["--import", "tsx", "tests/fixtures/setup-review.ts", dir, offlineId], { encoding: "utf8" });
  assert.equal(capture.status, 0, capture.stderr);
  const reviewId = capture.stdout.trim();
  assert.match(reviewId, /^[a-f0-9]{64}$/);
  for (const target of [workspace + "?step=3&settings=1", workspace + "?step=1", workspace + "?step=3&settings=1", base + "/settings/database-management/workspace"]) {
    const content = await page(target);
    if (!target.endsWith("step=1")) {
      assert.ok(content.includes(reviewId));
      assert.match(content, /Awaiting review/);
      assert.match(content, /SQL Server \(it_assets_offline_test\)/);
      assert.match(content, /Imported settings from:/);
      assert.match(content, /Compare current vs imported settings/);
      assert.match(content, /Application name/);
      assert.doesNotMatch(content, /Current setup at capture:|Use existing database settings/);
      assert.match(content, /<details[^>]*><summary[^>]*>[^<]*Technical details<\/summary>/);
      assert.match(content, /Use imported settings\?/);
    }
  }
  assert.match(await post("configuration-resolve", { id: reviewId, decision: "profile" }), /Confirm that you want/);
  assert.match(await page(), /Awaiting review/);
  assert.match(await post("configuration-resolve", { id: reviewId, decision: "profile", confirmation: "APPLY SNAPSHOT" }), /resolved/);
  assert.match(await page(), /Imported fixture/);
  assert.match(await post("configuration-restore", { id: reviewId, confirmation: "RESTORE" }), /restored/);
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
    inventoryCookie = login.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const readiness = await fetch(base + "/setup/status", {
      headers: { Cookie: cookie },
    });
    assert.equal(readiness.status, 200);
    const readyState = await readiness.json();
    assert.equal(readyState.ready, true);
    assert.equal(readyState.profile, id);
    assert.equal(readyState.revision, 1);
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
    assert.ok((await page(workspace + "?step=4")).includes("Active selection"));
    const review = await page(workspace + "?step=5");
    assert.match(review, /Setup checklist/);
    assert.doesNotMatch(review, /Add a connection|name="op" value="inspect"/);
    assert.match(await post("exit", { destination: "inventory" }), /Signed out|visit ended/i);
    const managementUrl = base + "/settings/database-management";
    const before = await page(managementUrl);
    for (const href of ["/dashboard", "/assets", "/settings"]) assert.ok(before.includes(`href="${href}"`));
    assert.match(before, /Installation administrator sign-in/);
    assert.match(await post("login", creds, "management"), /Signed in/);
    const protectedPage = await page(managementUrl + "/workspace");
    assert.match(protectedPage, /Back to Settings/);
    assert.ok(protectedPage.includes('href="/assets"'));
    assert.doesNotMatch(protectedPage, /Setup checklist|Review &amp; Complete/);
    assert.match(await post("save", { ...profile, name: "Second inventory", database: "it_assets_managed_" + (process.env.IT_ASSETS_TEST_RUN || "") + "b_test", revision: "1" }, "management"), /saved/);
    const secondHtml = await page(managementUrl + "/workspace");
    const secondId = getId(secondHtml.slice(secondHtml.indexOf("Second inventory")));
    assert.ok(secondId && secondId !== id);
    assert.match(await post("inspect", { id: secondId, revision: "1" }, "management"), /compatible/);
    const confirmHtml = await page(managementUrl + "/workspace");
    assert.match(confirmHtml, /<dialog/);
    assert.match(confirmHtml, /Confirm activation/);
    assert.match(await post("activate", { id: secondId, revision: "1", confirm: "wrong" }, "management"), /confirm/);
    assert.equal((await (await fetch(base + "/setup/status", { headers: { Cookie: cookies() } })).json()).profile, id);
    const visit = cookie;
    const settings = await fetch(base + "/settings", { headers: { Cookie: cookies(), Accept: "text/html" } });
    assert.equal(settings.status, 200);
    assert.equal((await fetch(managementUrl + "/session", { headers: { Cookie: visit } })).status, 401);
    assert.equal((await fetch(base + "/dashboard", { headers: { Cookie: inventoryCookie }, redirect: "manual" })).status, 200);
    cookie = "";
    assert.match(await post("login", creds, "management"), /Signed in/);
    const secondDatabase = "it_assets_managed_" + (process.env.IT_ASSETS_TEST_RUN || "") + "b_test";
    assert.match(await post("activate", { id: secondId, revision: "1", confirm: secondDatabase }, "management"), /Selection saved/);
    let switched;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      try {
        switched = await (await fetch(base + "/setup/status", { headers: { Cookie: cookie } })).json();
        if (switched.verified && switched.profile === secondId && switched.revision === 2) break;
      } catch {}
    }
    assert.equal(switched?.verified, true);
    assert.equal(switched?.profile, secondId);
    assert.equal(switched?.revision, 2);
    cookie = "";
    assert.match(await post("login", creds), /Signed in/);
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
  console.log("Isolated test control directory: " + dir);
} finally {
  if (server.connected) server.send("stop");
  await exited;
}
