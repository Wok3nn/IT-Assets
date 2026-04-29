export type DatabaseMode = "local" | "external";
export type DatabaseProvider = "sqlite" | "postgresql" | "mariadb" | "sqlserver";

export type DatabaseConfig = {
  mode: DatabaseMode;
  provider: DatabaseProvider;
  isSupportedCombination: boolean;
  errors: string[];
};

const defaultDatabaseMode: DatabaseMode = "local";
const defaultDatabaseProvider: DatabaseProvider = "mariadb";

const databaseModes = new Set<DatabaseMode>(["local", "external"]);
const databaseProviders = new Set<DatabaseProvider>(["sqlite", "postgresql", "mariadb", "sqlserver"]);
const allowedCombinations = new Set<string>([
  "local:postgresql",
  "local:mariadb",
  "external:sqlserver",
  "local:sqlite",
]);

type DatabaseConfigEnv = {
  DB_MODE?: string | undefined;
  DB_PROVIDER?: string | undefined;
};

function normalizeEnvValue(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isDatabaseMode(value: string): value is DatabaseMode {
  return databaseModes.has(value as DatabaseMode);
}

function isDatabaseProvider(value: string): value is DatabaseProvider {
  return databaseProviders.has(value as DatabaseProvider);
}

export function readDatabaseConfig(env: DatabaseConfigEnv = process.env as DatabaseConfigEnv): DatabaseConfig {
  const rawMode = normalizeEnvValue(env.DB_MODE);
  const rawProvider = normalizeEnvValue(env.DB_PROVIDER);
  const errors: string[] = [];

  const mode = rawMode
    ? isDatabaseMode(rawMode)
      ? rawMode
      : defaultDatabaseMode
    : defaultDatabaseMode;

  const provider = rawProvider
    ? isDatabaseProvider(rawProvider)
      ? rawProvider
      : defaultDatabaseProvider
    : defaultDatabaseProvider;

  if (rawMode && !isDatabaseMode(rawMode)) {
    errors.push(`Invalid DB_MODE "${env.DB_MODE}". Allowed values: local, external.`);
  }

  if (rawProvider && !isDatabaseProvider(rawProvider)) {
    errors.push(`Invalid DB_PROVIDER "${env.DB_PROVIDER}". Allowed values: sqlite, postgresql, mariadb, sqlserver.`);
  }

  if (errors.length === 0 && !allowedCombinations.has(`${mode}:${provider}`)) {
    errors.push(
      `Invalid database configuration: DB_MODE=${mode} and DB_PROVIDER=${provider}. Allowed combinations: local+sqlite (temporary), local+postgresql, local+mariadb, external+sqlserver.`,
    );
  }

  return {
    mode,
    provider,
    isSupportedCombination: errors.length === 0,
    errors,
  };
}

export function assertSupportedDatabaseConfig(env: DatabaseConfigEnv = process.env as DatabaseConfigEnv) {
  const config = readDatabaseConfig(env);

  if (!config.isSupportedCombination) {
    throw new Error(config.errors.join(" "));
  }

  return config;
}
