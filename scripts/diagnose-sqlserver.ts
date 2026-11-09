// Read-only: no deploy, resolve, reset, seed, registration or control-store writes.
import { DatabaseSync } from "node:sqlite";
import { createDecipheriv } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  profileSchema,
  type Profile,
} from "../src/modules/database-management/control-store";
import {
  connectionUrl,
  createProfileClient,
} from "../src/modules/database-management/profile-client";
import {
  databaseDiagnostic,
  type DatabaseStage,
} from "../src/modules/database-management/diagnostics";

async function main() {
  const database = process.argv[2];
  if (!database || process.argv.length !== 3)
    throw new Error(
      "Usage: node --import tsx scripts/diagnose-sqlserver.ts <exact-development-database-name>",
    );
  const directory = path.resolve(
    process.env.IT_ASSETS_CONTROL_DIR || ".managed-data",
  );
  const store = new DatabaseSync(path.join(directory, "control.sqlite"), {
    readOnly: true,
  });
  let profile: Profile;
  try {
    const matches = store
      .prepare("SELECT id,metadata,secret FROM profile")
      .all()
      .filter((row) => {
        const meta = JSON.parse(String(row.metadata));
        return meta.provider === "sqlserver" && meta.database === database;
      });
    if (matches.length !== 1)
      throw new Error(
        "Expected exactly one saved SQL Server profile for the named database. No connection attempted.",
      );
    const row = matches[0];
    const key = Buffer.from(
      readFileSync(path.join(directory, "control.key"), "utf8").trim(),
      "base64url",
    );
    const [iv, tag, bytes] = String(row.secret)
      .split(".")
      .map((s) => Buffer.from(s, "base64url"));
    const decrypt = createDecipheriv("aes-256-gcm", key, iv);
    decrypt.setAAD(Buffer.from(String(row.id) + String(row.metadata)));
    decrypt.setAuthTag(tag);
    profile = profileSchema.parse({
      ...JSON.parse(String(row.metadata)),
      ...JSON.parse(
        Buffer.concat([decrypt.update(bytes), decrypt.final()]).toString(),
      ),
    });
  } finally {
    store.close();
  }
  console.log(
    JSON.stringify({
      readOnly: true,
      provider: profile.provider,
      host: profile.host,
      port: profile.port,
      database: profile.database,
      trustCertificate: profile.trustCertificate,
    }),
  );
  const client = createProfileClient(profile);
  let stage: DatabaseStage = "connect";
  try {
    console.log(
      "connection",
      await client.$queryRaw`SELECT DB_NAME() AS databaseName, CAST(SERVERPROPERTY('EngineEdition') AS INT) AS engineEdition, HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION') AS canInspect, HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS canCreate`,
    );
    stage = "permissions";
    console.log(
      "exact application permission query",
      await client.$queryRaw`SELECT IS_MEMBER('db_owner') AS owner`,
    );
    stage = "inspect";
    console.log(
      "user objects",
      await client.$queryRaw`SELECT SCHEMA_NAME(schema_id) AS schemaName,name,type_desc FROM sys.objects WHERE is_ms_shipped=0 AND parent_object_id=0`,
    );
  } catch (error) {
    console.error(
      "[database-management]",
      JSON.stringify(databaseDiagnostic(error, stage, profile)),
    );
    process.exitCode = 1;
  } finally {
    await client.$disconnect();
  }
  // Inspect the CLI path independently; never deploy or automatically retry initialization.
  try {
    const result = await promisify(execFile)(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        "status",
        "--config",
        "prisma.managed.config.ts",
      ],
      {
        timeout: 30000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          DB_PROVIDER: "sqlserver",
          DATABASE_URL: connectionUrl(profile),
        },
      },
    );
    console.log("Prisma migrate status completed", {
      upToDate: /up to date/i.test(result.stdout),
    });
  } catch (error) {
    const diagnostic = databaseDiagnostic(error, "migrate-status", profile);
    const e = error as { stdout?: string; stderr?: string };
    const pending = /following migrations? have not yet been applied/i.test(
      String(e.stdout) + String(e.stderr),
    );
    if (pending && diagnostic.codes.length === 0)
      console.log(
        "Prisma migrate status: pending migrations (expected for an empty database). No migrations applied.",
      );
    else {
      console.error("[database-management]", JSON.stringify(diagnostic));
      process.exitCode = 1;
    }
  }
}
main().catch(() => {
  console.error(
    "Read-only diagnostic could not load the selected local profile. Verify the control directory and exact database name. No credentials or exception text emitted.",
  );
  process.exitCode = 1;
});
