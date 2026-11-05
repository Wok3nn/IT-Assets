import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { hkdfSync } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import storeModule from "../src/modules/database-management/control-store.ts";

// Do not load .env or .env.local. Legacy URLs/bootstrap files are never candidates.
const directory = path.resolve(
  process.env.IT_ASSETS_CONTROL_DIR || ".managed-data",
);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const owner = new DatabaseSync(path.join(directory, "owner.sqlite"));
try {
  owner.exec("BEGIN EXCLUSIVE");
} catch {
  throw new Error("Another supervisor owns this control directory.");
}
const store = new storeModule.ControlStore(directory);
const appUrl = process.env.IT_ASSETS_MANAGED_URL || "http://localhost:4050";
const directoryKey = readFileSync(
  path.join(directory, "control.key"),
  "utf8",
).trim();
const derive = (label) =>
  Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(directoryKey, "base64url"),
      Buffer.alloc(0),
      label,
      32,
    ),
  ).toString("base64url");
const dev = process.argv.includes("--dev");
const shared = {
  ...process.env,
  IT_ASSETS_MANAGED: "1",
  IT_ASSETS_CONTROL_DIR: directory,
  APP_URL: appUrl,
  DB_MODE: "local",
  DB_PROVIDER: "mariadb",
  DATABASE_URL: "mysql://disabled:disabled@127.0.0.1:1/disabled",
  APP_SETTINGS_ENCRYPTION_KEY:
    process.env.IT_ASSETS_MANAGED_SETTINGS_KEY || derive("settings"),
  SESSION_SECRET: derive("session"),
  IT_ASSETS_COOKIE_REALM: derive("cookie realm").slice(0, 12),
  SESSION_COOKIE_SECURE: "auto",
  BORROWED_REMINDER_DRY_RUN: "true",
  IT_ASSETS_MANAGED_DEV: dev ? "1" : "0",
  NODE_ENV: dev ? "development" : "production",
};
if (dev) {
  const generated = spawnSync(
    process.execPath,
    ["scripts/generate-clients.mjs"],
    { env: shared, stdio: "inherit" },
  );
  if (generated.status !== 0) process.exit(1);
}
if (!store.registered())
  console.log(
    "First-run token file: " + path.join(directory, "bootstrap-token"),
  );
let child,
  stopping = false,
  previous;
function stop() {
  stopping = true;
  if (child?.connected) child.send("drain");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("message", (message) => {
  if (message === "stop") stop();
});
try {
  while (!stopping) {
    const pinned = store.state();
    const env = {
      ...shared,
      IT_ASSETS_REVISION: String(pinned.revision),
      APP_DATA_DIR: path.join(
        directory,
        "workspaces",
        pinned.active || "unconfigured",
      ),
    };
    child = spawn(process.execPath, ["scripts/managed-web.mjs"], {
      env,
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      windowsHide: true,
    });
    let ready = false,
      draining = false;
    child.on("message", (m) => {
      if (m === "ready") ready = true;
    });
    const watch = setInterval(() => {
      if (
        !draining &&
        child.connected &&
        store.state().revision !== pinned.revision
      ) {
        draining = true;
        child.send("drain");
      }
    }, 750);
    const [code] = await once(child, "exit");
    clearInterval(watch);
    child = undefined;
    if (stopping) break;
    if (store.state().revision !== pinned.revision) {
      previous = pinned;
      continue;
    }
    if (!ready && previous) {
      store.activate(previous.active, pinned.revision);
      store.audit("startup rollback", previous.active);
      previous = undefined;
      continue;
    }
    process.exitCode = Number(code) || 1;
    break;
  }
} finally {
  store.close();
  owner.close();
  if (process.connected) process.disconnect();
}
