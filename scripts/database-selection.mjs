import fs from "node:fs";
import path from "node:path";

const defaultDatabaseMode = "local";
const defaultDatabaseProvider = "mariadb";
const validModes = new Set(["local", "external"]);
const validProviders = new Set(["sqlite", "postgresql", "mariadb", "sqlserver"]);
const allowedCombinations = new Set([
  "local:postgresql",
  "local:mariadb",
  "external:sqlserver",
  "local:sqlite",
]);
const currentScriptProviders = new Set(["sqlite", "postgresql", "mariadb", "sqlserver"]);
const providerDefaultPorts = {
  sqlite: null,
  postgresql: 5432,
  mariadb: 3306,
  sqlserver: 1433,
};
const prismaProviderNames = {
  sqlite: "sqlite",
  postgresql: "postgresql",
  mariadb: "mysql",
  sqlserver: "sqlserver",
};
const defaultLocalDatabaseUrls = {
  mariadb: "mysql://it_assets:change-me@mariadb:3306/it_assets",
};

function normalizeEnvValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getAppDataDir({ env = process.env, workspaceDir = process.cwd() } = {}) {
  const appDataDir = typeof env.APP_DATA_DIR === "string" ? env.APP_DATA_DIR.trim() : "";
  return appDataDir || path.join(workspaceDir, "data");
}

function getBootstrapConfigPath(options = {}) {
  return path.join(getAppDataDir(options), "state", "bootstrap.json");
}

function readBootstrapConfigSync(options = {}) {
  try {
    const rawConfig = JSON.parse(fs.readFileSync(getBootstrapConfigPath(options), "utf8"));
    return typeof rawConfig === "object" && rawConfig ? rawConfig : null;
  } catch {
    return null;
  }
}

function isValidSqlServerConnection(connection) {
  return Boolean(
    connection &&
      typeof connection.host === "string" &&
      connection.host.trim() &&
      Number.isInteger(connection.port) &&
      connection.port > 0 &&
      connection.port <= 65535 &&
      typeof connection.database === "string" &&
      connection.database.trim() &&
      typeof connection.username === "string" &&
      connection.username.trim() &&
      typeof connection.password === "string" &&
      connection.password.length > 0,
  );
}

function buildSqlServerDatabaseUrl(connection) {
  return `sqlserver://${connection.host.trim()}:${connection.port};database=${encodeURIComponent(connection.database.trim())};user=${encodeURIComponent(connection.username.trim())};password=${encodeURIComponent(connection.password)};encrypt=true;trustServerCertificate=true`;
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
    prismaProviderName: prismaProviderNames[config.provider],
    isCurrentScriptProvider: currentScriptProviders.has(config.provider),
  };
}

export function resolveEffectiveDatabaseUrl({ env = process.env, workspaceDir = process.cwd() } = {}) {
  const config = readDatabaseSelectionConfig(env);
  const envDatabaseUrl = typeof env.DATABASE_URL === "string" ? env.DATABASE_URL.trim() : "";

  if (envDatabaseUrl) {
    return envDatabaseUrl;
  }

  if (config.mode === "local" && config.provider in defaultLocalDatabaseUrls) {
    return defaultLocalDatabaseUrls[config.provider];
  }

  if (config.mode !== "external" || config.provider !== "sqlserver") {
    return envDatabaseUrl;
  }

  const bootstrapConfig = readBootstrapConfigSync({ env, workspaceDir });

  if (
    !bootstrapConfig ||
    bootstrapConfig.initialized !== true ||
    bootstrapConfig.dbMode !== "external" ||
    bootstrapConfig.dbProvider !== "sqlserver" ||
    !isValidSqlServerConnection(bootstrapConfig.connection)
  ) {
    return "";
  }

  return buildSqlServerDatabaseUrl(bootstrapConfig.connection);
}

export function isExternalBootstrapReady({ env = process.env, workspaceDir = process.cwd() } = {}) {
  const config = readDatabaseSelectionConfig(env);

  if (!config.isSupportedCombination || config.mode !== "external" || config.provider !== "sqlserver") {
    return false;
  }

  return Boolean(resolveEffectiveDatabaseUrl({ env, workspaceDir }));
}

export function resolveDatabaseConnectionInfo({ env = process.env, workspaceDir = process.cwd() } = {}) {
  const selection = readDatabaseSelectionConfig(env);
  const databaseUrl = resolveEffectiveDatabaseUrl({ env, workspaceDir });

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
