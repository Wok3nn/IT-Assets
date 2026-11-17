import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

// Run only inside the isolated acceptance Compose services. Never auto-discovers targets.
try {
  const config = JSON.parse(readFileSync("/acceptance-private/runtime.json", "utf8"));
  for (const [key, value] of Object.entries(config.environment)) {
    if (!["APP_TIME_ZONE", "TZ", "SESSION_SECRET"].includes(key) || typeof value !== "string") throw Error();
    process.env[key] = value;
  }
  process.env.APP_SETTINGS_ENCRYPTION_KEY = readFileSync("/acceptance-private/settings_key", "utf8").trim();
  if (config.entraReference) {
    if (!/^[A-Z][A-Z0-9_]*SECRET[A-Z0-9_]*$/.test(config.entraReference) || config.entraReference === "SESSION_SECRET") throw Error();
    process.env[config.entraReference] = readFileSync("/acceptance-private/entra_secret", "utf8").trim();
  }
  if (config.entraSecretPresent) process.env.IT_ASSETS_ENTRA_SECRET_UPGRADE = readFileSync("/acceptance-private/entra_secret", "utf8").trim();
  const [operation, ...args] = process.argv.slice(2);
  let command;
  if (operation === "legacy") {
    const host = process.env.ACCEPTANCE_DATABASE_HOST;
    if (!["inventory", "rollback-db"].includes(host) || args.length || !existsSync("/app/server.js")) throw Error();
    process.env.DATABASE_URL = readFileSync(`/acceptance-private/${host}_url`, "utf8").trim();
    Object.assign(process.env, { DB_MODE: "local", DB_PROVIDER: "mariadb", APP_DATA_DIR: "/data", PORT: "4050", HOSTNAME: "0.0.0.0", APP_URL: "http://localhost:4053", IT_ASSETS_MANAGED: "0" });
    // Exact legacy standalone server: deliberately bypass migrate/bootstrap entrypoint.
    command = ["/app/server.js"];
  } else {
    Object.assign(process.env, { IT_ASSETS_CONTROL_DIR: "/data/control", IT_ASSETS_BIND: "0.0.0.0", IT_ASSETS_MANAGED_URL: "http://localhost:4053", APP_URL: "http://localhost:4053", IT_ASSETS_LEGACY_BRANDING_DIR: "/legacy-branding", IT_ASSETS_ADOPT_DATABASE_URL_FILE: "/acceptance-private/inventory_url" });
    if (operation === "managed" && !args.length) command = ["--import", "tsx", "scripts/managed-start.mjs"];
    else if (operation === "check" && !args.length) command = ["--import", "tsx", "scripts/adopt-legacy.mjs", "check"];
    else if (["adopt", "stage-configuration"].includes(operation) && args.length === 1 && args[0] === "it_assets") command = ["--import", "tsx", "scripts/adopt-legacy.mjs", operation, "it_assets"];
    else if (["capture", "refresh"].includes(operation) && !args.length) {
      // Keep original key selection explicit; capture's default is a derived managed key.
      process.env.APP_SETTINGS_ENCRYPTION_KEY_FILE = "/acceptance-private/settings_key";
      delete process.env.APP_SETTINGS_ENCRYPTION_KEY;
      command = ["--import", "tsx", "scripts/capture-managed-configuration.mjs", operation, "adopted-legacy-mariadb", "it_assets"];
    } else if (operation === "snapshot") command = ["--import", "tsx", "/acceptance/snapshot.mjs", ...args];
    else throw Error();
  }
  const child = spawn(process.execPath, command, { cwd: "/app", env: process.env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("Acceptance process failed to start."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
} catch {
  console.error("Acceptance runtime refused configuration or command. Review private inputs; no values are printed.");
  process.exitCode = 1;
}
