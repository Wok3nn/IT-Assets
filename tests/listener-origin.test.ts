import test from "node:test";
import assert from "node:assert/strict";
import { listenerOrigin } from "../scripts/listener-origin.mjs";
test("self-fetch origin follows the internal listener independently of public port", () => {
  assert.equal(listenerOrigin({ address: "0.0.0.0", family: "IPv4", port: 4050 }), "http://127.0.0.1:4050");
  assert.equal(listenerOrigin({ address: "::", family: "IPv6", port: 9000 }), "http://[::1]:9000");
  assert.equal(listenerOrigin({ address: "10.1.2.3", family: "IPv4", port: 7000 }), "http://10.1.2.3:7000");
  assert.throws(() => listenerOrigin(null));
});
