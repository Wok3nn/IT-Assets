import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { readDatabaseConfig } from "@/services/database-config";
import { resolveExternalSqlServerBootstrapState, sqlServerConnectionSchema } from "@/services/external-database";
import { logger } from "@/services/logger";

const bootstrapConfigSchema = z.object({
  dbMode: z.enum(["local", "external"]).optional(),
  dbProvider: z.enum(["sqlite", "postgresql", "mariadb", "sqlserver"]).optional(),
  connection: sqlServerConnectionSchema.optional(),
  initialized: z.boolean(),
});

export type BootstrapConfig = z.infer<typeof bootstrapConfigSchema>;

const defaultBootstrapConfig: BootstrapConfig = {
  initialized: false,
};

function getAppDataDir() {
  return process.env.APP_DATA_DIR ?? path.join(process.cwd(), "data");
}

function getBootstrapStateDir() {
  return path.join(getAppDataDir(), "state");
}

function getBootstrapConfigPath() {
  return path.join(getBootstrapStateDir(), "bootstrap.json");
}

async function ensureBootstrapStateDir() {
  await mkdir(getBootstrapStateDir(), { recursive: true });
}

function ensureBootstrapStateDirSync() {
  if (!existsSync(getBootstrapStateDir())) {
    mkdirSync(getBootstrapStateDir(), { recursive: true });
  }
}

function parseBootstrapConfig(rawConfig: unknown) {
  const parsed = bootstrapConfigSchema.safeParse(rawConfig);
  return parsed.success ? parsed.data : null;
}

export async function readBootstrapConfig(): Promise<BootstrapConfig> {
  await ensureBootstrapStateDir();

  try {
    const fileContents = await readFile(getBootstrapConfigPath(), "utf8");
    const parsed = parseBootstrapConfig(JSON.parse(fileContents));

    if (!parsed) {
      logger.warn("[bootstrap] Invalid bootstrap config. Falling back to defaults.");
      return defaultBootstrapConfig;
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      logger.info("Bootstrap config not found");
      return defaultBootstrapConfig;
    }

    logger.warn("[bootstrap] Failed to read bootstrap config. Falling back to defaults.", error);
    return defaultBootstrapConfig;
  }
}

export function readBootstrapConfigSync(): BootstrapConfig {
  ensureBootstrapStateDirSync();

  try {
    const fileContents = readFileSync(getBootstrapConfigPath(), "utf8");
    const parsed = parseBootstrapConfig(JSON.parse(fileContents));

    if (!parsed) {
      return defaultBootstrapConfig;
    }

    return parsed;
  } catch {
    return defaultBootstrapConfig;
  }
}

export async function isBootstrapComplete() {
  if (process.env.IT_ASSETS_MANAGED === "1") {
    const { control } = await import("@/modules/database-management/control-store");
    return Boolean(control().state().active);
  }
  const databaseConfig = readDatabaseConfig();

  if (
    databaseConfig.isSupportedCombination &&
    databaseConfig.mode === "local" &&
    (databaseConfig.provider === "sqlite" ||
      databaseConfig.provider === "postgresql" ||
      databaseConfig.provider === "mariadb")
  ) {
    return true;
  }

  if (
    databaseConfig.isSupportedCombination &&
    databaseConfig.mode === "external" &&
    databaseConfig.provider === "sqlserver"
  ) {
    const config = await readBootstrapConfig();
    const externalState = resolveExternalSqlServerBootstrapState({
      bootstrapConfig: config,
      databaseConfig,
    });

    if (!externalState.isComplete) {
      logger.info("Bootstrap incomplete");
    }

    return externalState.isComplete;
  }

  const config = await readBootstrapConfig();

  if (!config.initialized) {
    logger.info("Bootstrap incomplete");
  }

  return config.initialized;
}
