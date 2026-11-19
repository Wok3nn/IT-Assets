import net from "node:net";
import { pathToFileURL } from "node:url";

// Fixed TCP destination only: no CONNECT, URL parsing, header rewriting or forward proxy.
export function createIngress(target, connect = options => net.createConnection(options)) {
  if (!["app", "legacy-check", "rollback"].includes(target)) throw new Error("Invalid acceptance ingress target.");
  const sockets = new Set();
  const server = net.createServer(client => {
    const upstream = connect({ host: target, port: 4050 });
    sockets.add(client); sockets.add(upstream);
    const close = () => { client.destroy(); upstream.destroy(); sockets.delete(client); sockets.delete(upstream); };
    client.on("error", close); upstream.on("error", close);
    client.on("close", () => { sockets.delete(client); upstream.destroy(); });
    upstream.on("close", () => {
      sockets.delete(upstream);
      // Normal EOF lets pipe end/flush the client; do not truncate buffered responses.
      if (!upstream.readableEnded) client.destroy();
    });
    // Bound dead connections; active streaming/WebSocket traffic refreshes the timeout.
    client.setTimeout(120000, close); upstream.setTimeout(120000, close);
    client.pipe(upstream); upstream.pipe(client);
  });
  server.maxConnections = 128;
  server.shutdown = () => { for (const socket of sockets) socket.destroy(); server.close(); };
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = createIngress(process.env.ACCEPTANCE_INGRESS_TARGET ?? "legacy-check");
    server.on("error", () => { console.error("Acceptance ingress failed to listen."); process.exitCode = 1; });
    server.listen(4050, "0.0.0.0");
    for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.shutdown());
  } catch { console.error("Acceptance ingress configuration refused."); process.exitCode = 1; }
}
