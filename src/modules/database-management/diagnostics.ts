import { randomUUID } from "node:crypto";
import type { Profile } from "./control-store";

export type DatabaseStage =
  | "inspect"
  | "permissions"
  | "migrate-deploy"
  | "bootstrap"
  | "connect"
  | "migrate-diff"
  | "migrate-status";
const hints: Record<string, string> = {
  P1000: "Database authentication failed.",
  P1001: "Cannot reach the database endpoint.",
  P1002: "Connection timed out.",
  P1003: "Database does not exist.",
  P1010: "Database access denied.",
  P1011: "TLS negotiation failed.",
  P1012: "Prisma schema/config validation failed.",
  P1013: "Connection URL could not be parsed.",
  P2010: "Raw SQL failed; inspect the database error code.",
  P2021: "Required table is missing.",
  P2022: "Required column is missing.",
  P2028: "Transaction failed or exceeded its timeout.",
  P3005: "Database is not empty. Do not initialize or reset it.",
  P3009: "Failed migration history exists; inspect it before any recovery.",
  P3018:
    "Migration SQL failed; inspect the database error code and migration name.",
  P3019: "Migration provider does not match the selected provider.",
  ENOENT: "Executable or required file was not found.",
  EACCES: "Process/file permission denied.",
  EPERM: "Process/file operation denied.",
  ENOBUFS: "CLI output exceeded the capture limit.",
  MODULE_NOT_FOUND: "CLI module was not found.",
};
const sqlHints: Record<string, string> = {
  "102": "SQL syntax error.",
  "156": "SQL syntax error near a keyword.",
  "262": "CREATE permission denied.",
  "229": "SQL object permission denied.",
  "2714": "An object already exists; inspect the target before proceeding.",
  "1785": "Foreign key cascade paths are incompatible.",
  "1934":
    "Required SQL session SET options are incorrect (including filtered-index requirements).",
  "18456": "SQL login rejected.",
  "4060": "Cannot open the requested database.",
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

// Deliberately do not log message, stack, command, stdout, stderr or Prisma meta.
// These can contain credentials from a driver, command line, connection URL or data row.
// Extract only validated codes and map them to static, actionable descriptions.
export function databaseDiagnostic(
  error: unknown,
  stage: DatabaseStage,
  profile: Profile,
) {
  const e = record(error),
    meta = record(e.meta);
  const raw = [e.message, e.stderr, e.stdout]
    .filter((v) => typeof v === "string")
    .join("\n");
  const codes = new Set<string>();
  for (const value of [e.code, e.errorCode])
    if (
      typeof value === "string" &&
      /^(P\d{4}|ENOENT|EACCES|EPERM|ENOBUFS|MODULE_NOT_FOUND)$/.test(value)
    )
      codes.add(value);
  for (const match of raw.matchAll(/\bP\d{4}\b|\bMODULE_NOT_FOUND\b/g))
    codes.add(match[0]);
  const databaseCodes = new Set<string>();
  if (typeof meta.code === "string" && /^\d{1,6}$/.test(meta.code))
    databaseCodes.add(meta.code);
  for (const match of raw.matchAll(
    /(?:Database error code|Error code|number):\s*(\d{1,6})\b/gi,
  ))
    databaseCodes.add(match[1]);
  // P3019 includes the two connector names. Report recognized providers only.
  const providerNames = codes.has("P3019")
    ? [
        ...new Set(
          raw.match(
            /\b(mssql|sqlserver|mysql|sqlite|postgresql|cockroachdb|mongodb)\b/g,
          ) ?? [],
        ),
      ]
    : undefined;
  return {
    reference: randomUUID(),
    stage,
    provider: profile.provider,
    // Public target fields only; never include login, password, profile name or URL.
    target: {
      host: profile.host,
      port: profile.port,
      database: profile.database,
    },
    prismaVersion: "6.19.2",
    codes: [...codes],
    databaseCodes: [...databaseCodes],
    providerNames,
    migration: raw.includes("20261105000000_inventory")
      ? "20261105000000_inventory"
      : undefined,
    exitCode: typeof e.code === "number" ? e.code : undefined,
    signal:
      typeof e.signal === "string" && /^SIG[A-Z0-9]+$/.test(e.signal)
        ? e.signal
        : undefined,
    killed: e.killed === true,
    hints: [...codes]
      .map(
        (c) => hints[c] ?? "Consult the Prisma error reference for this code.",
      )
      .concat(
        [...databaseCodes].map(
          (c) =>
            sqlHints[c] ??
            "Consult the SQL Server error reference for this number.",
        ),
      ),
  };
}
const logged = new WeakSet<object>();
export function logDatabaseFailure(
  error: unknown,
  stage: DatabaseStage,
  profile: Profile,
) {
  if (error && typeof error === "object") {
    if (logged.has(error)) return;
    logged.add(error);
  }
  console.error(
    "[database-management]",
    JSON.stringify(databaseDiagnostic(error, stage, profile)),
  );
}
