// Runs before Next handles any managed request. Only control sessions are revoked.
export function requiresInventory(pathname, managementPath) {
  if (pathname.startsWith("/api/installation-branding/") || pathname.startsWith("/api/branding/")) return false;
  if (
    ["/setup", "/setup/workspace", "/setup/status", "/setup/db"].includes(
      pathname,
    )
  )
    return false;
  if (pathname === managementPath || pathname.startsWith(managementPath + "/"))
    return false;
  if (pathname.startsWith("/api/")) return true;
  return (
    pathname === "/" ||
    [
      "login",
      "setup",
      "dashboard",
      "assets",
      "assets-v2",
      "borrowed-items",
      "categories",
      "labels",
      "locations",
      "scopes",
      "users",
      "settings",
      "patch-notes",
      "lookup",
    ].some(
      (root) =>
        pathname === "/" + root || pathname.startsWith("/" + root + "/"),
    )
  );
}
export function managementBoundary(req, res, url, store, config) {
  const {
    managementPath,
    managementWorkspacePath,
    controlCookie,
    visitFingerprint,
  } = config;
  const token =
    (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(controlCookie + "="))
      ?.slice(controlCookie.length + 1) || "";
  const inside =
    ["/setup", "/setup/workspace", "/setup/status"].includes(url.pathname) ||
    url.pathname === managementPath ||
    url.pathname.startsWith(managementPath + "/");
  if (inside || req.headers.accept?.includes("text/html") || req.headers.rsc) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
  }
  const revoke = () => {
    store.logout(token);
    res.setHeader(
      "Set-Cookie",
      `${controlCookie}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${config.origin.startsWith("https:") ? "; Secure" : ""}`,
    );
  };
  // Beacons carry a fingerprint, so a late unload cannot revoke a newer login.
  if (url.pathname === managementPath + "/leave") {
    if (req.method !== "POST" || req.headers.origin !== config.origin) {
      res.writeHead(403);
      res.end();
      return true;
    }
    if (url.searchParams.get("visit") === visitFingerprint(token)) revoke();
    res.writeHead(204);
    res.end();
    return true;
  }
  if (url.pathname === managementPath + "/session") {
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end();
      return true;
    }
    res.writeHead(store.authorized(token) ? 204 : 401);
    res.end();
    return true;
  }
  const prefetch =
    req.headers["next-router-prefetch"] ||
    req.headers["purpose"] === "prefetch" ||
    req.headers["sec-purpose"]?.includes("prefetch");
  if (prefetch && inside) {
    res.writeHead(204);
    res.end();
    return true;
  }
  const navigation =
    req.method === "GET" &&
    !prefetch &&
    (req.headers["sec-fetch-dest"] === "document" ||
      req.headers.accept?.includes("text/html") ||
      req.headers.rsc);
  if (
    ([managementPath, "/setup"].includes(url.pathname) &&
      req.method === "GET") ||
    (navigation &&
      !inside &&
      !url.pathname.startsWith("/_next/") &&
      !url.pathname.startsWith("/api/"))
  )
    revoke();
  // Back/replayed requests are authorized against the store, never just the cookie.
  if (
    [managementWorkspacePath, "/setup/workspace"].includes(url.pathname) &&
    req.method === "GET" &&
    !store.authorized(token)
  ) {
    res.writeHead(303, {
      Location: url.pathname.startsWith("/setup") ? "/setup?message=Session%20expired.%20Sign%20in%20to%20resume.&returnStep=" + (/^[1-5]$/.test(url.searchParams.get("step") || "") ? url.searchParams.get("step") : "3") : managementPath,
    });
    res.end();
    return true;
  }
  return false;
}
