import { NextResponse } from "next/server";
import path from "node:path";

import { readDatabaseConfig } from "@/services/database-config";
import {
  buildSqlServerDatabaseUrl,
  getSqlServerBootstrapFailureMessage,
  sqlServerConnectionSchema,
} from "@/services/external-database";
import { logger } from "@/services/logger";
import { prepareProviderMigrationsForRuntime, runNodeCommand, testDatabaseConnectionViaPrisma } from "@/services/prisma-runtime";
import { writeBootstrapConfig } from "@/services/bootstrap-config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const databaseConfig = readDatabaseConfig();

  if (
    !databaseConfig.isSupportedCombination ||
    databaseConfig.mode !== "external" ||
    databaseConfig.provider !== "sqlserver"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "External database bootstrap is only available for SQL Server mode.",
      },
      { status: 409 },
    );
  }

  const body = await request.json();
  const parsed = sqlServerConnectionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const connection = parsed.data;
  const databaseUrl = buildSqlServerDatabaseUrl(connection);
  const workspaceDir = process.cwd();
  const bootstrapEnv = {
    ...process.env,
    DB_MODE: "external",
    DB_PROVIDER: "sqlserver",
    DATABASE_URL: databaseUrl,
  };

  try {
    await testDatabaseConnectionViaPrisma(databaseUrl);
    await prepareProviderMigrationsForRuntime({
      provider: "sqlserver",
      prismaProviderName: "sqlserver",
    });
    await runNodeCommand({
      args: [path.join(workspaceDir, "scripts", "prisma-provider.mjs"), "generate"],
      env: bootstrapEnv,
      label: "Prisma generate",
    });
    await runNodeCommand({
      args: [path.join(workspaceDir, "scripts", "prisma-provider.mjs"), "migrate", "deploy"],
      env: bootstrapEnv,
      label: "Prisma migrate deploy",
    });
    await runNodeCommand({
      args: [path.join(workspaceDir, "scripts", "bootstrap.mjs")],
      env: bootstrapEnv,
      label: "Application bootstrap",
    });

    process.env.DATABASE_URL = databaseUrl;

    await writeBootstrapConfig({
      dbMode: "external",
      dbProvider: "sqlserver",
      connection,
      initialized: true,
    });
  } catch {
    logger.warn("[bootstrap] External SQL Server bootstrap failed.");
    return NextResponse.json(
      {
        ok: false,
        message: getSqlServerBootstrapFailureMessage(),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    redirectTo: "/setup",
  });
}
