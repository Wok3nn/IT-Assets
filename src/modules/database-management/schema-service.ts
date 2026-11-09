import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ControlError, type Profile } from "./control-store";
import { connectionUrl, createProfileClient } from "./profile-client";
import { logDatabaseFailure, type DatabaseStage } from "./diagnostics";
import type { Organization } from "./setup-state";
const run = promisify(execFile);
const history = (p: Profile) =>
  path.join(
    "prisma",
    p.provider === "sqlserver" ? "managed-migrations" : "migrations",
    p.provider,
  );
async function cli(p: Profile, args: string[]) {
  try {
    return await run(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        ...args,
        "--config",
        "prisma.managed.config.ts",
      ],
      {
        timeout: 120000,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          ...process.env,
          DB_PROVIDER: p.provider,
          DATABASE_URL: connectionUrl(p),
        },
      },
    );
  } catch (error) {
    logDatabaseFailure(
      error,
      args[1] === "deploy" ? "migrate-deploy" : "migrate-diff",
      p,
    );
    throw error;
  }
}
export type Classification =
  | "empty"
  | "compatible"
  | "partial"
  | "incompatible";
async function catalog(db: PrismaClient, p: Profile) {
  if (p.provider === "sqlserver") {
    const [info] = await db.$queryRaw<
      { name: string; visible: number }[]
    >`SELECT DB_NAME() AS name,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION') AS visible`;
    if (info?.name !== p.database || Number(info.visible) !== 1)
      throw new ControlError(
        "Verify the database name and grant database-level VIEW DEFINITION for safe inspection.",
      );
    return db.$queryRaw<
      { name: string; schemaName: string }[]
    >`SELECT name,SCHEMA_NAME(schema_id) AS schemaName FROM sys.objects WHERE is_ms_shipped=0 AND parent_object_id=0`;
  }
  const [info] = await db.$queryRaw<
    { name: string }[]
  >`SELECT DATABASE() AS name`;
  const grants =
    await db.$queryRawUnsafe<Record<string, string>[]>("SHOW GRANTS");
  const visible = grants.flatMap(Object.values).some((g) => {
    const m = /^GRANT (.+?) ON (.+?) TO /i.exec(g);
    if (!m) return false;
    // Metadata-filtered catalogs are not proof of emptiness. Require database-wide access.
    return (
      [p.database + ".*", "*.*"].includes(m[2].replaceAll("`", "")) &&
      /(^|, )(ALL PRIVILEGES|SELECT)(,|$)/.test(m[1])
    );
  });
  if (info.name !== p.database || !visible)
    throw new ControlError(
      "Verify the database name and grant database-wide SELECT for schema inspection.",
    );
  return db.$queryRaw<
    { name: string; schemaName: string }[]
  >`SELECT TABLE_NAME AS name,TABLE_SCHEMA AS schemaName FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
    UNION ALL SELECT ROUTINE_NAME,ROUTINE_SCHEMA FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()
    UNION ALL SELECT EVENT_NAME,EVENT_SCHEMA FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()`;
}
async function inspect(db: PrismaClient, p: Profile): Promise<Classification> {
  const objects = await catalog(db, p);
  if (!objects.length) return "empty";
  const known = new Set([
    "_prisma_migrations",
    ...Prisma.dmmf.datamodel.models.map((m) =>
      (m.dbName ?? m.name).toLowerCase(),
    ),
  ]);
  if (
    objects.some(
      (o) =>
        !known.has(o.name.toLowerCase()) ||
        o.schemaName !== (p.provider === "sqlserver" ? "dbo" : p.database),
    )
  )
    return "incompatible";
  if (
    !objects.some(
      (x) =>
        x.name === "_prisma_migrations" &&
        x.schemaName === (p.provider === "sqlserver" ? "dbo" : p.database),
    )
  )
    return objects.some((x) =>
      ["user", "setupstate", "asset"].includes(x.name.toLowerCase()),
    )
      ? "partial"
      : "incompatible";
  const rows = await db.$queryRawUnsafe<
    {
      migration_name: string;
      checksum: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }[]
  >(
    "SELECT migration_name,checksum,finished_at,rolled_back_at FROM " +
      (p.provider === "sqlserver" ? "dbo." : "") +
      "_prisma_migrations",
  );
  const dirs = (await readdir(history(p), { withFileTypes: true })).filter(
    (d) => d.isDirectory(),
  );
  const applied = rows.filter((r) => !r.rolled_back_at);
  if (applied.some((r) => !r.finished_at) || dirs.length !== applied.length)
    return "partial";
  for (const d of dirs) {
    const sql = await readFile(
      path.join(history(p), d.name, "migration.sql"),
      "utf8",
    );
    const checks = [
      sql,
      sql.replace(/\r\n/g, "\n"),
      sql.replace(/\r?\n/g, "\r\n"),
    ].map((s) => createHash("sha256").update(s).digest("hex"));
    if (
      !applied.some(
        (r) => r.migration_name === d.name && checks.includes(r.checksum),
      )
    )
      return "incompatible";
  }
  // Match live DDL, not just names in migration history. Only allow the two known
  // filtered-index representation differences after independently verifying their predicates.
  const schema = "prisma/providers/" + p.provider + "/schema.prisma";
  const { stdout } = await cli(p, [
    "migrate",
    "diff",
    "--from-schema-datasource",
    schema,
    "--to-schema-datamodel",
    schema,
    "--script",
  ]);
  let ddl = stdout.replace(/^\s*--[^\n]*/gm, "").trim();
  if (p.provider === "sqlserver") {
    const indexes = await db.$queryRaw<
      {
        name: string;
        filter_definition: string;
        tableName: string;
        columnName: string;
        keyCount: number;
      }[]
    >`SELECT i.name,i.filter_definition,OBJECT_NAME(i.object_id) AS tableName,COL_NAME(i.object_id,c.column_id) AS columnName,(SELECT COUNT(*) FROM sys.index_columns k WHERE k.object_id=i.object_id AND k.index_id=i.index_id AND k.key_ordinal>0) AS keyCount FROM sys.indexes i JOIN sys.index_columns c ON c.object_id=i.object_id AND c.index_id=i.index_id AND c.key_ordinal=1 WHERE OBJECT_SCHEMA_NAME(i.object_id)='dbo' AND i.is_unique=1 AND i.is_disabled=0 AND i.has_filter=1`;
    for (const [table, column] of [
      ["Location", "code"],
      ["BorrowedItem", "activeAssetId"],
    ]) {
      const key = table + "_" + column + "_key";
      if (
        !indexes.some(
          (i) =>
            i.name === key &&
            i.tableName === table &&
            i.columnName === column &&
            Number(i.keyCount) === 1 &&
            i.filter_definition.replace(/[\s()[\]]/g, "").toLowerCase() ===
              column.toLowerCase() + "isnotnull",
        )
      )
        return "incompatible";
      ddl = ddl.replace(
        `ALTER TABLE [dbo].[${table}] ADD CONSTRAINT [${key}] UNIQUE NONCLUSTERED ([${column}]);`,
        "",
      );
    }
    ddl = ddl
      .replace(
        /^BEGIN TRY\s*BEGIN TRAN;\s*([\s\S]*?)\s*COMMIT TRAN;\s*END TRY\s*BEGIN CATCH[\s\S]*END CATCH\s*$/i,
        "$1",
      )
      .trim();
  }
  if (ddl.trim()) return "incompatible";
  if (!(await db.setupState.findFirst({ where: { isCompleted: true } })))
    return "partial";
  return "compatible";
}
export async function checkProfile(p: Profile) {
  const db = createProfileClient(p);
  try {
    return await inspect(db, p);
  } catch (error) {
    logDatabaseFailure(error, "inspect", p);
    throw error;
  } finally {
    await db.$disconnect();
  }
}
export async function testConnection(p: Profile) {
  const db = createProfileClient(p);
  try {
    await db.$queryRaw`SELECT 1 AS healthy`;
  } catch (error) {
    logDatabaseFailure(error, "connect", p);
    throw error;
  } finally {
    await db.$disconnect();
  }
}
export async function initializeProfile(
  p: Profile,
  email: string,
  passwordHash: string,
  organization?: Organization,
) {
  const db = createProfileClient(p);
  let stage: DatabaseStage = "inspect";
  try {
    if ((await inspect(db, p)) !== "empty")
      throw new ControlError(
        "Initialization requires an empty database. Nothing was applied.",
      );
    stage = "permissions";
    if (p.provider === "mariadb") {
      // SELECT alone may hide routines/events. Require full database ownership during initialization.
      const grants =
        await db.$queryRawUnsafe<Record<string, string>[]>("SHOW GRANTS");
      if (
        !grants.flatMap(Object.values).some((g) => {
          const m = /^GRANT ALL PRIVILEGES ON (.+?) TO /i.exec(g);
          return (
            m && [p.database + ".*", "*.*"].includes(m[1].replaceAll("`", ""))
          );
        })
      )
        throw new ControlError(
          "Initialization needs ALL PRIVILEGES on this dedicated MariaDB database.",
        );
    }
    if (p.provider === "sqlserver") {
      const [permissions] = await db.$queryRaw<
        { owner: number }[]
      >`SELECT IS_MEMBER('db_owner') AS owner`;
      if (Number(permissions.owner) !== 1)
        throw new ControlError(
          "Initialization requires db_owner on this empty SQL Server database. Use a separate runtime login afterward.",
        );
    }
    stage = "migrate-deploy";
    await cli(p, ["migrate", "deploy"]);
    stage = "bootstrap";
    await db.$transaction(async (tx) => {
      const roles = [
        ["SUPER_ADMIN", "Super Admin"],
        ["ADMIN", "Admin"],
        ["MANAGER", "Manager"],
        ["VIEWER", "Viewer"],
      ];
      for (const [key, name] of roles)
        await tx.role.create({ data: { key, name } });
      for (const [key, name, color] of [
        ["IN_STOCK", "In Stock", "#0f766e"],
        ["ASSIGNED", "Assigned", "#2563eb"],
        ["MAINTENANCE", "Maintenance", "#d97706"],
        ["RETIRED", "Retired", "#64748b"],
      ])
        await tx.assetStatus.create({ data: { key, name, color } });
      await tx.user.create({
        data: {
          email,
          passwordHash,
          name: "Workspace administrator",
          userRoles: { create: { role: { connect: { key: "SUPER_ADMIN" } } } },
        },
      });
      await tx.setupState.create({
        data: {
          isCompleted: true,
          initializedAt: new Date(),
          siteName: organization?.siteName ?? p.name,
        },
      });
      if (organization)
        await tx.setting.create({
          data: {
            category: "general",
            key: "app.title",
            value: organization.appTitle,
          },
        });
    });
  } catch (error) {
    logDatabaseFailure(error, stage, p);
    throw error;
  } finally {
    await db.$disconnect();
  }
}
