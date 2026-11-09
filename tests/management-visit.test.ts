import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  managementBoundary,
  requiresInventory,
} from "../scripts/management-boundary.mjs";
import {
  ControlStore,
  controlCookie,
  managementPath,
  managementWorkspacePath,
  visitFingerprint,
} from "../src/modules/database-management/control-store";

test("offline request boundary excludes inventory before concurrent Next rendering", () => {
  for (const route of [
    "/",
    "/assets/new",
    "/settings",
    "/login",
    "/api/settings/import/assets",
    "/lookup/assets/test",
  ])
    assert.ok(requiresInventory(route, managementPath));
  for (const route of [
    "/installation",
    managementPath,
    managementWorkspacePath,
    "/_next/static/test.js",
    "/branding/logo.png",
  ])
    assert.equal(requiresInventory(route, managementPath), false);
});

test("management entry, exit, history and CSRF are enforced independently of inventory cookies", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "it-assets-visits-"));
  const store = new ControlStore(dir);
  store.enroll(
    readFileSync(path.join(dir, "bootstrap-token"), "utf8"),
    "admin@example.invalid",
    "Disposable management password",
  );
  const login = () =>
    store.login("admin@example.invalid", "Disposable management password");
  const config = {
    controlCookie,
    managementPath,
    managementWorkspacePath,
    visitFingerprint,
    origin: "http://localhost:4050",
  };
  function request(
    url: string,
    token: string,
    extra: Record<string, string> = {},
    method = "GET",
  ) {
    const headers: Record<string, string> = {};
    let status = 200;
    const response = {
      setHeader: (key: string, value: string) => {
        headers[key] = value;
      },
      writeHead: (code: number, h = {}) => {
        status = code;
        Object.assign(headers, h);
      },
      end() {},
    };
    const handled = managementBoundary(
      {
        method,
        headers: {
          cookie: `${controlCookie}=${token}; inventory_session=preserve-me`,
          accept: "text/html",
          ...extra,
        },
      },
      response,
      new URL(url, config.origin),
      store,
      config,
    );
    assert.ok(!String(headers["Set-Cookie"]).includes("inventory_session"));
    return { status, headers, handled };
  }
  try {
    let token = login();
    request(managementPath, token, { "next-router-prefetch": "1" });
    assert.ok(store.authorized(token), "prefetch does not end a visit");
    request(managementWorkspacePath, token);
    assert.ok(
      store.authorized(token),
      "normal in-area requests retain session",
    );
    request(managementPath, token);
    assert.equal(
      store.authorized(token),
      false,
      "new entry revokes old session",
    );
    assert.equal(request(managementWorkspacePath, token).status, 303);
    token = login();
    request("/installation", token);
    assert.equal(
      store.authorized(token),
      false,
      "leaving revokes server-side state",
    );
    const replay = request(managementWorkspacePath, token);
    assert.equal(replay.status, 303);
    assert.match(replay.headers["Cache-Control"], /no-store/);
    token = login();
    const leave = managementPath + "/leave?visit=" + visitFingerprint(token);
    assert.equal(
      request(leave, token, { origin: "https://attacker.invalid" }, "POST")
        .status,
      403,
    );
    assert.ok(store.authorized(token));
    request(
      managementPath + "/leave?visit=stale",
      token,
      { origin: config.origin },
      "POST",
    );
    assert.ok(store.authorized(token), "late beacon cannot revoke new login");
    request(leave, token, { origin: config.origin }, "POST");
    assert.equal(store.authorized(token), false);
    assert.equal(request(managementPath + "/session", token).status, 401);
  } finally {
    store.close();
  }
});

test("management sessions expire after one hour and enrollment stays closed on restart", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "it-assets-expiry-"));
  let store = new ControlStore(dir);
  const bootstrap = readFileSync(path.join(dir, "bootstrap-token"), "utf8");
  store.enroll(
    bootstrap,
    "admin@example.invalid",
    "Disposable management password",
  );
  const session = store.login(
    "admin@example.invalid",
    "Disposable management password",
  );
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 3600001);
  assert.equal(store.authorized(session), false);
  store.close();
  store = new ControlStore(dir);
  try {
    assert.equal(store.authorized(session), false);
    assert.throws(
      () =>
        store.enroll(
          bootstrap,
          "admin@example.invalid",
          "Disposable management password",
        ),
      /closed/,
    );
    assert.equal(store.state().active, null);
  } finally {
    store.close();
  }
});
