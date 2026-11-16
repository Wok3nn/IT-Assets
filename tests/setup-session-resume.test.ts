import test from "node:test";
import assert from "node:assert/strict";
import { managementBoundary } from "../scripts/management-boundary.mjs";
test("setup refresh and step navigation preserve a valid visit; expiration preserves only a safe step", () => {
  let authorized = true, revocations = 0;
  const store = { authorized: () => authorized, logout: () => { revocations++; } } as unknown as Parameters<typeof managementBoundary>[3];
  const config = { managementPath: "/settings/database-management", managementWorkspacePath: "/settings/database-management/workspace", controlCookie: "visit", visitFingerprint: (s: string) => s, origin: "http://localhost:4052" };
  for (const step of ["2", "3", "4", "5", "https://evil.invalid/"]) {
    let status = 0, location = "";
    const response = { setHeader() {}, writeHead(code: number, headers?: Record<string, string>) { status = code; location = headers?.Location ?? ""; }, end() {} } as unknown as Parameters<typeof managementBoundary>[1];
    const request = { method: "GET", headers: { cookie: "visit=fixture", accept: "text/html" } } as Parameters<typeof managementBoundary>[0];
    const url = new URL("http://localhost:4052/setup/workspace?step=" + encodeURIComponent(step));
    authorized = true;
    assert.equal(managementBoundary(request, response, url, store, config), false);
    assert.equal(revocations, 0);
    authorized = false;
    assert.equal(managementBoundary(request, response, url, store, config), true);
    assert.equal(status, 303);
    assert.equal(new URL(location, url).searchParams.get("returnStep"), /^[1-5]$/.test(step) ? step : "3");
  }
});
