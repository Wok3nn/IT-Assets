import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import http from "node:http";
import net from "node:net";
import storeModule from "../src/modules/database-management/control-store.ts";
const { encodeReply } = createRequire(import.meta.url)("next/dist/compiled/react-server-dom-webpack/client.node");
// Separate loopback address avoids the operator's localhost SSH tunnel.
const probe = net.createServer();
probe.listen(4050, "127.0.0.2");
await once(probe, "listening");
await new Promise(resolve => probe.close(resolve));
const directory = mkdtempSync(path.join(tmpdir(), "it-assets-redirect-"));
const store = new storeModule.ControlStore(directory);
store.enroll(readFileSync(path.join(directory, "bootstrap-token"), "utf8").trim(), "operator@example.invalid", "Disposable redirect password", { siteName: "Redirect fixture", appTitle: "Redirect fixture" });
store.close();
const manifest = JSON.parse(readFileSync(".next-managed/server/server-reference-manifest.json", "utf8"));
const action = Object.keys(manifest.node).find(id => manifest.node[id].exportedName === "databaseAction");
assert.ok(action);
const server = spawn(process.execPath, ["--import", "tsx", "scripts/managed-start.mjs"], {
  env: { ...process.env, IT_ASSETS_CONTROL_DIR: directory, IT_ASSETS_MANAGED_URL: "http://localhost:4052", IT_ASSETS_BIND: "127.0.0.2" },
  stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true,
});
const exited = once(server, "exit");
let logs = "", cookie = "";
server.stderr.on("data", chunk => { logs += String(chunk); process.stderr.write(chunk); });
try {
  await Promise.race([new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Startup timeout")), 60000); timer.unref();
    server.stdout.on("data", chunk => { process.stdout.write(chunk); if (String(chunk).includes("IT Assets ready at")) { clearTimeout(timer); resolve(); } });
  }), exited.then(() => { throw Error("Test listener unavailable"); })]);
  async function post(op, values = {}, origin = "http://localhost:4052", forwarded = false) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ op, context: "setup", ...values })) form.set(key, value);
    console.log("Testing action: " + op);
    // Serialize React's multipart body, then use http.request to preserve Host
    // (some Node fetch versions override a caller-provided Host header).
    const encoded = new Request("http://127.0.0.2:4050/setup/workspace", { method: "POST", body: await encodeReply([form]) });
    const body = Buffer.from(await encoded.arrayBuffer());
    const response = await new Promise((resolve, reject) => {
      const req = http.request(encoded.url, { method: "POST", signal: AbortSignal.timeout(15000), headers: {
        ...Object.fromEntries(encoded.headers), Host: forwarded ? "internal.invalid:4050" : "localhost:4052",
        ...(forwarded ? { "X-Forwarded-Host": typeof forwarded === "string" ? forwarded : "localhost:4052" } : {}),
        Origin: origin, "Next-Action": action, Cookie: cookie,
      } }, res => {
        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => {
          const headers = new Headers();
          for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }));
        });
      });
      req.on("error", reject); req.end(body);
    });
    const session = response.headers.getSetCookie().find(value => value.startsWith("it_assets_management_visit="));
    if (session) cookie = session.split(";")[0];
    return response;
  }
  const login = await post("login", { email: "operator@example.invalid", password: "Disposable redirect password", returnStep: "3" });
  console.log("Login response: " + login.status); assert.equal(login.status, 303);
  assert.match(login.headers.get("content-type"), /text\/x-component/);
  assert.match(await login.text(), /Database Connection/);
  for (let i = 0; i < 2; i++) {
    const response = await post("save", { name: "Offline " + i, provider: "sqlserver", host: "127.0.0.1", port: "1", database: "redirect_fixture", username: "fixture", password: "fixture", revision: "0" }, "http://localhost:4052", i === 1);
    assert.equal(response.status, 303);
    assert.match(response.headers.get("content-type"), /text\/x-component/);
    assert.match(response.headers.get("x-action-redirect"), /Profile%20saved/);
    await response.text();
  }
  const forbidden = await post("save", {}, "http://attacker.invalid");
  assert.ok(forbidden.status >= 400); await forbidden.text();
  // Matching forged proxy headers must still fail the application's APP_URL check.
  const forged = await post("save", {}, "http://attacker.invalid", "attacker.invalid");
  assert.ok(forged.status >= 400); await forged.text();
  const logout = await post("logout");
  assert.equal(logout.status, 303); await logout.text();
  const session = await fetch("http://127.0.0.2:4050/settings/database-management/session", { headers: { Host: "localhost:4052", Cookie: cookie } });
  assert.equal(session.status, 401);
  assert.doesNotMatch(logs, /failed to get redirect response|ECONNREFUSED.*4052/);
  console.log("PASS: external Host/Origin 4052, internal listener 4050, streamed action redirects, repeated authorized saves, foreign-origin rejection and logout; isolated control store only.");
} finally { if (server.connected) server.send("stop"); await exited; }
