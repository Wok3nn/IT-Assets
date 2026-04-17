import path from "node:path";

const defaultDatabaseMode = "local";
const defaultDatabaseProvider = "sqlite";
const validModes = new Set(["local", "external"]);
const validProviders = new Set(["sqlite", "postgresql", "mariadb", "sqlserver"]);
const allowedCombinations = new Set([
  "local:postgresql",
  "local:mariadb",
  "external:sqlserver",
  "local:sqlite",
]);
const currentScriptProviders = new Set(["sqlite", "postgresql"]);
const providerDefaultPorts = {
  sqlite: null,
  postgresql: 5432,
  mariadb: 3306,
  sqlserver: 1433,
};

function normalizeEnvValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function readDatabaseSelectionConfig(env = process.env) {
  const rawMode = normalizeEnvValue(env.DB_MODE);
  const rawProvider = normalizeEnvValue(env.DB_PROVIDER);
  const errors = [];

  const mode = rawMode
    ? validModes.has(rawMode)
      ? rawMode
      : defaultDatabaseMode
    : defaultDatabaseMode;

  const provider = rawProvider
    ? validProviders.has(rawProvider)
      ? rawProvider
      : defaultDatabaseProvider
    : defaultDatabaseProvider;

  if (rawMode && !validModes.has(rawMode)) {
    errors.push(`Invalid DB_MODE "${env.DB_MODE}". Allowed values: local, external.`);
  }

  if (rawProvider && !validProviders.has(rawProvider)) {
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

export function resolveDatabaseSelection({ env = process.env, workspaceDir = process.cwd() } = {}) {
  const config = readDatabaseSelectionConfig(env);

  return {
    ...config,
    schemaPath: path.join(workspaceDir, "prisma", "providers", config.provider, "schema.prisma"),
    providerMigrationsPath: path.join(workspaceDir, "prisma", "migrations", config.provider),
    migrationsRootPath: path.join(workspaceDir, "prisma", "migrations"),
    isCurrentScriptProvider: currentScriptProviders.has(config.provider),
  };
}

export function resolveDatabaseConnectionInfo({ env = process.env } = {}) {
  const selection = readDatabaseSelectionConfig(env);
  const databaseUrl = typeof env.DATABASE_URL === "string" ? env.DATABASE_URL.trim() : "";

  if (!databaseUrl) {
    return {
      provider: selection.provider,
      databaseUrl,
      host: null,
      port: providerDefaultPorts[selection.provider],
    };
  }

  if (selection.provider === "sqlite") {
    return {
      provider: selection.provider,
      databaseUrl,
      host: null,
      port: null,
    };
  }

  const parsedUrl = new URL(databaseUrl);
  const defaultPort = providerDefaultPorts[selection.provider];

  return {
    provider: selection.provider,
    databaseUrl,
    host: parsedUrl.hostname || null,
    port: parsedUrl.port ? Number(parsedUrl.port) : defaultPort,
  };
}

export function assertScriptDatabaseSelection(options = {}) {
  const selection = resolveDatabaseSelection(options);

  if (!selection.isSupportedCombination) {
    throw new Error(selection.errors.join(" "));
  }

  if (!selection.isCurrentScriptProvider) {
    throw new Error(
      `DB_MODE=${selection.mode} and DB_PROVIDER=${selection.provider} match the planned contract, but Prisma script execution does not support ${selection.provider} in this phase.`,
    );
  }

  return selection;
}
