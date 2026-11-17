import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { hkdfSync } from "node:crypto";
import storeModule from "../src/modules/database-management/control-store.ts";
import capture from "../src/modules/database-management/managed-configuration-capture.ts";
import { loadDeploymentSecrets } from "./deployment-secrets.mjs";

let owner, store;
try {
  const [operation, profile, confirmation, ...extra] = process.argv.slice(2);
  if (!["capture", "refresh"].includes(operation) || !profile || !confirmation || extra.length)
    throw new storeModule.ControlError("Usage: node --import tsx scripts/capture-managed-configuration.mjs capture|refresh PROFILE_ID EXACT_DATABASE_NAME. Stop the managed app and all configuration writers first.");
  const directory = process.env.IT_ASSETS_CONTROL_DIR;
  if (!directory || !path.isAbsolute(directory)) throw new storeModule.ControlError("Set an explicit absolute IT_ASSETS_CONTROL_DIR. No default or discovery is allowed.");
  loadDeploymentSecrets();
  if (process.env.IT_ASSETS_MANAGED_SETTINGS_KEY) process.env.APP_SETTINGS_ENCRYPTION_KEY = process.env.IT_ASSETS_MANAGED_SETTINGS_KEY;
  owner = new DatabaseSync(path.join(directory, "owner.sqlite")); owner.exec("BEGIN EXCLUSIVE");
  store = new storeModule.ControlStore(directory);
  if (!process.env.IT_ASSETS_MANAGED_SETTINGS_KEY && !process.env.APP_SETTINGS_ENCRYPTION_KEY_FILE) {
    const key = readFileSync(path.join(directory, "control.key"), "utf8").trim();
    process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.from(hkdfSync("sha256", Buffer.from(key, "base64url"), Buffer.alloc(0), "settings", 32)).toString("base64url");
  }
  if (store.profile(profile).database !== confirmation) throw new storeModule.ControlError("The database name does not match the chosen saved profile.");
  const id = await capture.captureManagedConfiguration(store, directory, profile, operation === "refresh");
  console.log("Configuration review captured: " + id + ". No inventory writes, activation or runtime promotion. Sign in separately as Installation Administrator to review the captured snapshot.");
} catch (error) {
  console.error(error instanceof storeModule.ControlError ? error.message : "Capture failed. Check offline ownership, source compatibility, original keys and profile branding. No inventory writes or activation were performed.");
  process.exitCode = 1;
} finally { store?.close(); owner?.close(); }
