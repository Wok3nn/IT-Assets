import { readFileSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Reads only disposable restore endpoints or the stopped acceptance control store.
// Reports equality/count summaries; never serializes raw rows, settings or credentials.
const require = createRequire("/app/package.json");
const serialize = value => JSON.stringify(value, (_key, entry) => typeof entry === "bigint" ? entry.toString() : entry);
let db, store, owner;
try {
  const [kind, operation, label, baseline, mode = "exact"] = process.argv.slice(2);
  if (!["inventory", "rollback-db", "configuration", "adoption"].includes(kind) || !["record", "compare"].includes(operation) ||
      !/^[a-z0-9-]{1,60}$/.test(label ?? "") || (operation === "compare" && !/^[a-z0-9-]{1,60}$/.test(baseline ?? "")) || !["exact", "workspace", "globals"].includes(mode)) throw Error();
  const key = readFileSync("/acceptance-private/digest_key", "utf8");
  const fingerprint = value => createHmac("sha256", key).update(serialize(value)).digest("hex");
  let result;
  if (kind === "configuration" || kind === "adoption") {
    const { DatabaseSync } = await import("node:sqlite");
    owner = new DatabaseSync("/data/control/owner.sqlite"); owner.exec("BEGIN EXCLUSIVE");
    const loaded = await import(pathToFileURL("/app/src/modules/database-management/control-store.ts").href);
    const { ControlStore } = loaded.default ?? loaded;
    store = new ControlStore("/data/control");
    const configuration = store.installationConfiguration();
    if (!configuration) throw Error();
    const enabled = [store.presentationRuntime(), store.entraRuntime(), store.mailRuntime(), store.timezoneRuntime()].map(Boolean);
    if (kind === "adoption") {
      const adoptionModule = await import(pathToFileURL("/app/src/modules/database-management/legacy-adoption.ts").href);
      const adoption = adoptionModule.default ?? adoptionModule;
      const input = readFileSync("/acceptance-private/inventory_url", "utf8").trim();
      const parsed = new URL(input);
      if (parsed.hostname !== "inventory" || parsed.pathname !== "/it_assets" || parsed.username !== "acceptance") throw Error();
      const inspected = await adoption.inspectLegacyAdoption(input, "/legacy-branding", true);
      let expected = inspected.installation;
      if (store.entraRuntime()) {
        const loaded = await import(pathToFileURL("/app/src/modules/database-management/installation-entra.ts").href);
        expected = (loaded.default ?? loaded).persistEntraCredential(expected);
      }
      if (store.mailRuntime()) {
        const loaded = await import(pathToFileURL("/app/src/modules/database-management/installation-mail.ts").href);
        expected = (loaded.default ?? loaded).persistMailCredential(expected);
      }
      const canonicalModule = await import(pathToFileURL("/app/src/modules/database-management/installation-configuration.ts").href);
      const canonical = (canonicalModule.default ?? canonicalModule).canonicalInstallationConfiguration;
      if (fingerprint(canonical(expected)) !== fingerprint(canonical(configuration))) throw Error();
      if (!enabled[0] || !enabled[2] || !enabled[3] || (expected.settings["authentication.entra.secretReference"] && !enabled[1])) throw Error();
      if (store.organization()?.appTitle !== store.presentation()?.appTitle) throw Error();
    }
    result = { format: 1, kind: "configuration", global: fingerprint({ configuration, organization: store.organization(), enabled }), selection: fingerprint(store.state().active), enabled };
  } else {
    const url = readFileSync(`/acceptance-private/${kind}_url`, "utf8").trim(), parsed = new URL(url);
    if (parsed.hostname !== kind || parsed.pathname !== "/it_assets" || parsed.username !== "acceptance" || parsed.port !== "3306") throw Error();
    const { PrismaClient } = require("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url } }, log: [] });
    const tables = await db.$queryRawUnsafe("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
    if (!tables.length) throw Error();
    const records = {};
    for (const { name } of tables) {
      if (!/^[A-Za-z0-9_]+$/.test(name)) throw Error();
      const rows = await db.$queryRawUnsafe("SELECT * FROM `" + name + "`");
      const stable = rows.map(row => {
        if (name !== "User") return row;
        const copy = { ...row }; delete copy.lastLoginAt; delete copy.updatedAt; return copy;
      });
      records[name] = { count: rows.length, full: fingerprint(rows.map(serialize).sort()), stable: fingerprint(stable.map(serialize).sort()) };
    }
    result = { format: 1, kind: "database", records };
  }
  if (operation === "compare") {
    const previous = JSON.parse(readFileSync(`/evidence/${baseline}.json`, "utf8"));
    const normalized = data => {
      if (mode === "globals") { if (data.kind !== "configuration") throw Error(); return data.global; }
      if (mode === "workspace") {
        if (data.kind !== "database") throw Error();
        return Object.fromEntries(Object.entries(data.records).filter(([name]) => name !== "Session").map(([name, value]) => [name, { count: value.count, stable: value.stable }]));
      }
      return data;
    };
    if (serialize(normalized(previous)) !== serialize(normalized(result))) throw Error();
  }
  writeFileSync(`/evidence/${label}.json`, serialize(result), { flag: "wx", mode: 0o600 });
  console.log(`PASS: ${kind} ${operation}; protected fingerprints saved. No record or credential values printed.`);
} catch {
  console.error("FAIL: acceptance snapshot refused or comparison changed. Check private evidence and quiescence; no raw data is printed.");
  process.exitCode = 1;
} finally { await db?.$disconnect(); store?.close(); owner?.close(); }
