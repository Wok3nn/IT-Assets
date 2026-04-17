import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { readDatabaseConfig } from "@/services/database-config";
import { logger } from "@/services/logger";

const bootstrapConnectionSchema = z.object({
  host: z.string(),
  port: z.number().int(),
  database: z.string(),
  username: z.string(),
  password: z.string(),
});

const bootstrapConfigSchema = z.object({
  dbMode: z.enum(["local", "external"]).optional(),
  dbProvider: z.enum(["sqlite", "postgresql", "mariadb", "sqlserver"]).optional(),
  connection: bootstrapConnectionSchema.optional(),
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

export async function readBootstrapConfig(): Promise<BootstrapConfig> {
  await ensureBootstrapStateDir();

  try {
    const fileContents = await readFile(getBootstrapConfigPath(), "utf8");
    const parsed = bootstrapConfigSchema.safeParse(JSON.parse(fileContents));

    if (!parsed.success) {
      logger.warn("[bootstrap] Invalid bootstrap config. Falling back to defaults.");
      return defaultBootstrapConfig;
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      logger.info("Bootstrap config not found");
      return defaultBootstrapConfig;
    }

    logger.warn("[bootstrap] Failed to read bootstrap config. Falling back to defaults.", error);
    return defaultBootstrapConfig;
  }
}

export async function writeBootstrapConfig(input: BootstrapConfig) {
  await ensureBootstrapStateDir();

  const normalized = bootstrapConfigSchema.parse(input);
  await writeFile(getBootstrapConfigPath(), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return normalized;
}

export async function isBootstrapComplete() {
  const databaseConfig = readDatabaseConfig();

  if (
    databaseConfig.isSupportedCombination &&
    databaseConfig.mode === "local" &&
    (databaseConfig.provider === "sqlite" || databaseConfig.provider === "postgresql")
  ) {
    return true;
  }

  const config = await readBootstrapConfig();

  if (!config.initialized) {
    logger.info("Bootstrap incomplete");
  }

  return config.initialized;
}
