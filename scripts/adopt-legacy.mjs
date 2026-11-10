import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import storeModule from "../src/modules/database-management/control-store.ts";
import adoption from "../src/modules/database-management/legacy-adoption.ts";
import { loadDeploymentSecrets } from "./deployment-secrets.mjs";

// Offline host-administrator operation. Never import/activate at app startup.
let owner, store;
try {
  const [operation, confirmation, ...extra] = process.argv.slice(2);
  if (!["check", "adopt"].includes(operation) || extra.length || (operation === "check" && confirmation))
    throw new storeModule.ControlError("Usage: node --import tsx scripts/adopt-legacy.mjs check | adopt EXACT_DATABASE_NAME. Stop the managed app first.");
  if (!process.env.IT_ASSETS_CONTROL_DIR || !path.isAbsolute(process.env.IT_ASSETS_CONTROL_DIR) || !process.env.IT_ASSETS_ADOPT_DATABASE_URL_FILE)
    throw new storeModule.ControlError("Set an absolute IT_ASSETS_CONTROL_DIR and explicit IT_ASSETS_ADOPT_DATABASE_URL_FILE. Ambient DATABASE_URL is never imported.");
  loadDeploymentSecrets();
  if (process.env.IT_ASSETS_MANAGED_SETTINGS_KEY) process.env.APP_SETTINGS_ENCRYPTION_KEY = process.env.IT_ASSETS_MANAGED_SETTINGS_KEY;
  const directory = process.env.IT_ASSETS_CONTROL_DIR;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  owner = new DatabaseSync(path.join(directory, "owner.sqlite"));
  owner.exec("BEGIN EXCLUSIVE");
  const value = readFileSync(process.env.IT_ASSETS_ADOPT_DATABASE_URL_FILE, "utf8");
  const target = adoption.parseLegacyConnection(value);
  if (operation === "adopt" && confirmation !== target.database)
    throw new storeModule.ControlError("Type the exact target database name to authorize adoption. No activation is performed.");
  const candidate = await adoption.inspectLegacyAdoption(value, process.env.IT_ASSETS_LEGACY_BRANDING_DIR);
  console.log(JSON.stringify({ provider: target.provider, host: target.host, port: target.port, database: target.database, compatible: true, brandingFiles: candidate.branding.length }));
  if (operation === "adopt") {
    store = new storeModule.ControlStore(directory);
    const id = adoption.saveLegacyAdoption(store, directory, candidate);
    console.log(`Connection saved as ${id}. Start the app, enroll/sign in, inspect and explicitly activate in Database Management. No inventory rows or schema were changed.`);
  } else console.log("Preflight passed. No profile saved. Production acceptance is still required.");
} catch (error) {
  // Raw database/URL/OS errors may contain credentials or secret paths.
  console.error(error instanceof storeModule.ControlError ? error.message : "Adoption failed. Check offline ownership, secret files, connectivity, schema and configuration. No database writes or activation were performed.");
  process.exitCode = 1;
} finally { store?.close(); owner?.close(); }
