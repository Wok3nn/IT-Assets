import { z } from "zod";

import type { DatabaseConfig } from "@/services/database-config";

export const sqlServerConnectionSchema = z.object({
  host: z.string().trim().min(1, "Host is required."),
  port: z.number().int().min(1).max(65535),
  database: z.string().trim().min(1, "Database is required."),
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

export type SqlServerConnectionInput = z.infer<typeof sqlServerConnectionSchema>;

type ExternalBootstrapConfigLike = {
  dbMode?: string | undefined;
  dbProvider?: string | undefined;
  connection?: unknown;
  initialized?: boolean | undefined;
};

export function readSqlServerConnection(input: unknown) {
  const parsed = sqlServerConnectionSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function buildSqlServerDatabaseUrl(connection: SqlServerConnectionInput) {
  const normalized = sqlServerConnectionSchema.parse(connection);

  return `sqlserver://${normalized.host}:${normalized.port};database=${encodeURIComponent(normalized.database)};user=${encodeURIComponent(normalized.username)};password=${encodeURIComponent(normalized.password)};encrypt=true;trustServerCertificate=true`;
}

export function getSqlServerConnectionFailureMessage() {
  return "Unable to connect to SQL Server with the provided settings. Verify host, port, database, username, password, and server availability.";
}

export function getSqlServerBootstrapFailureMessage() {
  return "External SQL Server bootstrap failed. Verify the connection settings and ensure the target database is reachable and writable.";
}

export function resolveExternalSqlServerBootstrapState({
  bootstrapConfig,
  databaseConfig,
}: {
  bootstrapConfig: ExternalBootstrapConfigLike;
  databaseConfig: DatabaseConfig;
}) {
  if (
    !databaseConfig.isSupportedCombination ||
    databaseConfig.mode !== "external" ||
    databaseConfig.provider !== "sqlserver"
  ) {
    return {
      connection: null,
      databaseUrl: null,
      isComplete: false,
    };
  }

  const connection = readSqlServerConnection(bootstrapConfig.connection);

  if (
    bootstrapConfig.initialized !== true ||
    bootstrapConfig.dbMode !== "external" ||
    bootstrapConfig.dbProvider !== "sqlserver" ||
    !connection
  ) {
    return {
      connection,
      databaseUrl: null,
      isComplete: false,
    };
  }

  return {
    connection,
    databaseUrl: buildSqlServerDatabaseUrl(connection),
    isComplete: true,
  };
}
