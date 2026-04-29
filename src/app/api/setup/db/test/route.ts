import { NextResponse } from "next/server";

import { readDatabaseConfig } from "@/services/database-config";
import {
  buildSqlServerDatabaseUrl,
  getSqlServerConnectionFailureMessage,
  sqlServerConnectionSchema,
} from "@/services/external-database";
import { logger } from "@/services/logger";
import { testDatabaseConnectionViaPrisma } from "@/services/prisma-runtime";

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
        message: "Database connection testing is only available for external SQL Server mode.",
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

  try {
    await testDatabaseConnectionViaPrisma(buildSqlServerDatabaseUrl(parsed.data));
  } catch {
    logger.warn("[bootstrap] SQL Server connection test failed.");
    return NextResponse.json(
      {
        ok: false,
        message: getSqlServerConnectionFailureMessage(),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
