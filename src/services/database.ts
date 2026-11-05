import { PrismaClient } from "@prisma/client";
import { control, managed } from "@/modules/database-management/control-store";
import { createProfileClient } from "@/modules/database-management/profile-client";

import { readBootstrapConfigSync } from "@/services/bootstrap-config";
import { readDatabaseConfig } from "@/services/database-config";
import { resolveExternalSqlServerBootstrapState } from "@/services/external-database";

declare global {
  var prismaClientsByUrl: Map<string, PrismaClient> | undefined;
}

function resolveEffectiveDatabaseUrl() {
  const databaseConfig = readDatabaseConfig();
  const envUrl = process.env.DATABASE_URL?.trim();

  if (
    databaseConfig.isSupportedCombination &&
    databaseConfig.mode === "external" &&
    databaseConfig.provider === "sqlserver"
  ) {
    const externalState = resolveExternalSqlServerBootstrapState({
      bootstrapConfig: readBootstrapConfigSync(),
      databaseConfig,
    });

    if (externalState.isComplete && externalState.databaseUrl) {
      return externalState.databaseUrl;
    }
  }

  return envUrl || null;
}

function getPrismaClient() {
  if (managed()) {
    const state = control().state();
    if (!state.active || String(state.revision) !== process.env.IT_ASSETS_REVISION) {
      throw new Error("No active database for this process revision.");
    }
    const cache = global.prismaClientsByUrl ??= new Map<string, PrismaClient>();
    const key = "managed:" + state.revision;
    let client = cache.get(key);
    if (!client) {
      client = createProfileClient(control().profile(state.active));
      cache.set(key, client);
    }
    return client;
  }
  const databaseUrl = resolveEffectiveDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("Database URL is not configured for the current application mode.");
  }

  const clientCache = global.prismaClientsByUrl ?? new Map<string, PrismaClient>();
  const existingClient = clientCache.get(databaseUrl);

  if (existingClient) {
    return existingClient;
  }

  const client = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  clientCache.set(databaseUrl, client);
  global.prismaClientsByUrl = clientCache;

  return client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});
