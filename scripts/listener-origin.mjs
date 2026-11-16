// Use the bound socket, never browser Host/forwarded headers, for Next self-fetches.
export function listenerOrigin(address) {
  if (!address || typeof address === "string") throw new Error("A TCP listener is required.");
  const host = address.address === "0.0.0.0" ? "127.0.0.1" : address.address === "::" ? "::1" : address.address;
  return `http://${host.includes(":") ? `[${host}]` : host}:${address.port}`;
}
