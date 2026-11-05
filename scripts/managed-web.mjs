import http from "node:http";
import next from "next";
const dev = process.env.IT_ASSETS_MANAGED_DEV === "1";
const hostname = process.env.IT_ASSETS_BIND || "127.0.0.1",
  port = 4050;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();
let draining = false,
  server;
const upgraded = new Set();
async function drain() {
  if (draining) return;
  draining = true;
  for (const socket of upgraded) socket.destroy();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await app.close();
  process.exit(0);
}
process.on("message", (m) => {
  if (m === "drain") void drain();
});
process.on("disconnect", () => void drain());
process.on("SIGTERM", () => void drain());
process.on("SIGINT", () => void drain());
await app.prepare();
server = http.createServer((req, res) => {
  if (draining) {
    res.writeHead(503, { "Retry-After": "2" });
    return res.end("Inventory is switching.");
  }
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    res.writeHead(400);
    return res.end("Invalid request URL.");
  }
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    url.pathname !== "/settings/database-management" &&
    req.headers["x-it-assets-revision"] !== process.env.IT_ASSETS_REVISION &&
    url.searchParams.get("_inventory") !== process.env.IT_ASSETS_REVISION
  ) {
    res.writeHead(409);
    return res.end(
      "Inventory selection changed. Reload the page before submitting.",
    );
  }
  return handler(req, res);
});
server.on("upgrade", (req, socket, head) => {
  upgraded.add(socket);
  socket.once("close", () => upgraded.delete(socket));
  return app.getUpgradeHandler()(req, socket, head);
});
server.listen(port, hostname, () => {
  console.log("IT Assets ready at " + process.env.APP_URL);
  process.send?.("ready");
});
