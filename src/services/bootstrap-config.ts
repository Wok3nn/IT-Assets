import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
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

export async function writeBootstrapConfig(input: BootstrapConfig) {
  await ensureBootstrapStateDir();

  const normalized = bootstrapConfigSchema.parse(input);
  await writeFile(getBootstrapConfigPath(), `${JSON.stringify(normalized, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(getBootstrapConfigPath(), 0o600).catch(() => {});
  try {
    chmodSync(getBootstrapConfigPath(), 0o600);
  } catch {}

  return normalized;
}

export async function isBootstrapComplete() {
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
