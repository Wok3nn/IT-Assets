import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import net from "node:net";
import { once } from "node:events";
const require = createRequire(import.meta.url);
const yaml = require("js-yaml");

test("acceptance publishes only a hardened fixed-target ingress, never applications or databases", () => {
  const compose = yaml.load(readFileSync("docker/compose.acceptance.yml", "utf8"));
  assert.equal(compose.networks.isolated.internal, true);
  assert.notEqual(compose.networks.ingress.internal, true);
  for (const name of ["app", "legacy-check", "rollback", "maintenance", "inventory", "rollback-db"]) {
    assert.deepEqual(compose.services[name].networks, ["isolated"]);
    assert.equal(compose.services[name].ports, undefined);
  }
  const relay = compose.services.ingress;
  assert.deepEqual(relay.ports, ["127.0.0.1:4053:4050"]);
  assert.deepEqual(relay.networks, ["ingress", "isolated"]);
  assert.deepEqual(relay.cap_drop, ["ALL"]);
  assert.equal(relay.sysctls["net.ipv4.ip_forward"], "0");
  assert.equal(relay.read_only, true);
  assert.equal(relay.user, "1000:1000");
  assert.deepEqual(relay.security_opt, ["no-new-privileges:true"]);
  assert.equal(relay.volumes.length, 1);
  assert.match(relay.volumes[0], /ingress\.mjs:ro$/);
  assert.equal(relay.privileged, undefined);
  assert.equal(relay.network_mode, undefined);
  for (const service of Object.values(compose.services) as { volumes?: string[] }[]) assert.ok(!service.volumes?.some(value => value.includes("docker.sock")));
  const sql = yaml.load(readFileSync("docker/compose.acceptance-sql.yml", "utf8"));
  assert.deepEqual(sql.services.app.networks, ["isolated", "approved_sql"]);
});

test("ingress relays bytes unchanged to each allowed target and cannot select arbitrary destinations", async () => {
  const source = "../scripts/acceptance/ingress.mjs";
  const { createIngress } = await import(source);
  for (const invalid of ["graph.microsoft.com", "inventory", "127.0.0.1", "app:443", ""]) assert.throws(() => createIngress(invalid));
  for (const target of ["legacy-check", "app", "rollback"]) {
    const received: Buffer[] = [];
    const backend = net.createServer(socket => socket.on("data", data => { received.push(data); socket.write(data); }));
    backend.listen(0, "127.0.0.1"); await once(backend, "listening");
    const relay = createIngress(target, (options: { host: string; port: number }) => {
      assert.deepEqual(options, { host: target, port: 4050 });
      return net.createConnection({ host: "127.0.0.1", port: (backend.address() as net.AddressInfo).port });
    });
    relay.listen(0, "127.0.0.1"); await once(relay, "listening");
    const client = net.createConnection({ host: "127.0.0.1", port: (relay.address() as net.AddressInfo).port });
    const request = Buffer.from("POST /setup/workspace HTTP/1.1\r\nHost: localhost:4053\r\nOrigin: http://localhost:4053\r\nX-Forwarded-Host: forged.invalid\r\nNext-Action: fixture\r\nContent-Length: 4\r\n\r\nbody");
    try {
      const echo = new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        client.on("error", reject);
        client.on("data", data => { chunks.push(data); if (Buffer.concat(chunks).length >= request.length) resolve(Buffer.concat(chunks)); });
      });
      client.write(request);
      assert.deepEqual(await echo, request);
      assert.deepEqual(Buffer.concat(received), request);
    } finally { client.destroy(); relay.shutdown(); await new Promise<void>(resolve => backend.close(() => resolve())); }
  }
});
