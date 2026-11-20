import { snapshotDiagnostics, readInstallationState, verifyAdoption } from "./snapshot-validation.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Reads only disposable restore endpoints or the stopped acceptance control store.
// Reports equality/count summaries; never serializes raw rows, settings or credentials.
const serialize = value => JSON.stringify(value, (_key, entry) => typeof entry === "bigint" ? entry.toString() : entry);
const diagnostic = snapshotDiagnostics(process.env.IT_ASSETS_ACCEPTANCE_DIAGNOSTICS);
const failure = "FAIL: acceptance snapshot refused or comparison changed. Check private evidence and quiescence; no raw data is printed.";
let db, store, owner;
let failed = false;
try {
  diagnostic.at("INVALID_ARGUMENTS");
  const [kind, operation, label, baseline, mode = "exact"] = process.argv.slice(2);
  if (!["inventory", "rollback-db", "configuration", "adoption"].includes(kind) || !["record", "compare"].includes(operation) ||
      !/^[a-z0-9-]{1,60}$/.test(label ?? "") || (operation === "compare" && !/^[a-z0-9-]{1,60}$/.test(baseline ?? "")) || !["exact", "workspace", "globals"].includes(mode)) throw Error();
  diagnostic.at("DIGEST_KEY_UNAVAILABLE");
  const key = readFileSync("/acceptance-private/digest_key", "utf8");
  const fingerprint = value => createHmac("sha256", key).update(serialize(value)).digest("hex");
  let result;
  if (kind === "configuration" || kind === "adoption") {
    diagnostic.at("CONTROL_STORE_LOAD_FAILED");
    const { DatabaseSync } = await import("node:sqlite");
    owner = new DatabaseSync("/data/control/owner.sqlite"); owner.exec("BEGIN EXCLUSIVE");
    const loaded = await import(pathToFileURL("/app/src/modules/database-management/control-store.ts").href);
    const { ControlStore } = loaded.default ?? loaded;
    store = new ControlStore("/data/control");
    const { configuration, enabled } = readInstallationState(store, diagnostic);
    if (kind === "adoption") {
      await verifyAdoption({ store, configuration, enabled, fingerprint,
        load: async name => {
          const loaded = await import(pathToFileURL(`/app/src/modules/database-management/${name}.ts`).href);
          return loaded.default ?? loaded;
        },
        readLegacyUrl: () => readFileSync("/acceptance-private/inventory_url", "utf8").trim(),
      }, diagnostic);
    }
    diagnostic.at("SNAPSHOT_BUILD_FAILED");
    result = { format: 1, kind: "configuration", global: fingerprint({ configuration, organization: store.organization(), enabled }), selection: fingerprint(store.state().active), enabled };
  } else {
    diagnostic.at("INVENTORY_READ_FAILED");
    const url = readFileSync(`/acceptance-private/${kind}_url`, "utf8").trim(), parsed = new URL(url);
    if (parsed.hostname !== kind || parsed.pathname !== "/it_assets" || parsed.username !== "acceptance" || parsed.port !== "3306") throw Error();
    const { PrismaClient } = createRequire("/app/package.json")("@prisma/client");
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
    diagnostic.at("EVIDENCE_READ_FAILED");
    const previous = JSON.parse(readFileSync(`/evidence/${baseline}.json`, "utf8"));
    diagnostic.at("EVIDENCE_COMPARISON_FAILED");
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
  diagnostic.at("EVIDENCE_WRITE_FAILED");
  writeFileSync(`/evidence/${label}.json`, serialize(result), { flag: "wx", mode: 0o600 });
  console.log(`PASS: ${kind} ${operation}; protected fingerprints saved. No record or credential values printed.`);
} catch {
  failed = true;
  console.error(failure);
  if (diagnostic.line()) console.error(diagnostic.line());
  for (const line of diagnostic.details()) console.error(line);
  process.exitCode = 1;
} finally {
  // Cleanup errors must not leak raw provider or filesystem exception messages.
  for (const close of [() => db?.$disconnect(), () => store?.close(), () => owner?.close()]) {
    try { await close(); } catch {
      if (!failed) {
        diagnostic.at("CLEANUP_FAILED");
        console.error(failure);
        if (diagnostic.line()) console.error(diagnostic.line());
        failed = true;
      }
      process.exitCode = 1;
    }
  }
}
