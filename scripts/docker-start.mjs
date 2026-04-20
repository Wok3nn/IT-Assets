import { spawn } from "node:child_process";
import net from "node:net";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { assertScriptDatabaseSelection, resolveDatabaseConnectionInfo } from "./database-selection.mjs";

const workspaceDir = process.cwd();
const databaseSelection = assertScriptDatabaseSelection({ workspaceDir });
const databaseConnectionInfo = resolveDatabaseConnectionInfo();
const appDataDir = (process.env.APP_DATA_DIR ?? "/data").trim() || "/data";
const databaseUrl = (process.env.DATABASE_URL ?? "file:/data/db/app.db").trim() || "file:/data/db/app.db";
const prismaMigrationsRoot = path.join(workspaceDir, "prisma", "migrations");

function resolveSqliteDatabasePath(url) {
  if (!url.startsWith("file:")) return null;

  const filePath = url.slice("file:".length);

  if (!filePath) return null;

  return path.isAbsolute(filePath) ? filePath : path.resolve(workspaceDir, filePath);
}

async function ensureStartupDirectories() {
  await mkdir(appDataDir, { recursive: true });
  await mkdir(path.join(appDataDir, "state"), { recursive: true });
  await mkdir(path.join(appDataDir, "uploads"), { recursive: true });

  const sqlitePath = databaseSelection.provider === "sqlite" ? resolveSqliteDatabasePath(databaseUrl) : null;

  if (sqlitePath) {
    await mkdir(path.dirname(sqlitePath), { recursive: true });
  }
}

async function prepareProviderMigrations() {
  const providerMigrationsPath = path.join(prismaMigrationsRoot, databaseSelection.provider);
  const providerEntries = await readdir(providerMigrationsPath, { withFileTypes: true });

  if (providerEntries.length === 0) {
    throw new Error(`No Prisma migrations found for provider "${databaseSelection.provider}" in ${providerMigrationsPath}.`);
  }

  const hasMigrationLock = providerEntries.some((entry) => entry.isFile() && entry.name === "migration_lock.toml");
  const migrationDirectoryNames = providerEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  if (!hasMigrationLock) {
    throw new Error(
      `Prisma provider migrations for "${databaseSelection.provider}" are missing migration_lock.toml in ${providerMigrationsPath}.`,
    );
  }

  if (migrationDirectoryNames.length === 0) {
    throw new Error(
      `Prisma provider migrations for "${databaseSelection.provider}" do not include any migration directories in ${providerMigrationsPath}.`,
    );
  }

  const rootEntries = await readdir(prismaMigrationsRoot, { withFileTypes: true });

  await Promise.all(
    rootEntries
      .filter((entry) => entry.name !== databaseSelection.provider)
      .map((entry) => rm(path.join(prismaMigrationsRoot, entry.name), { recursive: true, force: true })),
  );

  await mkdir(prismaMigrationsRoot, { recursive: true });

  await Promise.all(
    providerEntries.map((entry) =>
      cp(path.join(providerMigrationsPath, entry.name), path.join(prismaMigrationsRoot, entry.name), {
        recursive: true,
        force: true,
      }),
    ),
  );

  await rm(providerMigrationsPath, { recursive: true, force: true });

  const preparedEntries = await readdir(prismaMigrationsRoot, { withFileTypes: true });
  const preparedNames = preparedEntries.map((entry) => entry.name).sort();
  const preparedHasMigrationLock = preparedEntries.some((entry) => entry.isFile() && entry.name === "migration_lock.toml");
  const preparedMigrationDirectories = preparedEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  console.log(`Prepared Prisma migrations for provider "${databaseSelection.provider}" in ${prismaMigrationsRoot}.`);
  console.log(`Prisma migrations root contents: ${preparedNames.join(", ") || "(empty)"}`);
  console.log(`Prisma migration_lock.toml present: ${preparedHasMigrationLock ? "yes" : "no"}`);
  console.log(
    `Prisma migration directories present: ${preparedMigrationDirectories.join(", ") || "(none)"}`,
  );

  if (!preparedHasMigrationLock) {
    throw new Error(`Prepared Prisma migrations root is missing migration_lock.toml in ${prismaMigrationsRoot}.`);
  }

  if (preparedMigrationDirectories.length === 0) {
    throw new Error(`Prepared Prisma migrations root has no migration directories in ${prismaMigrationsRoot}.`);
  }

  const preparedMigrationStats = await Promise.all(
    preparedMigrationDirectories.map(async (directoryName) => ({
      directoryName,
      stats: await stat(path.join(prismaMigrationsRoot, directoryName)),
    })),
  );

  if (preparedMigrationStats.some(({ stats }) => !stats.isDirectory())) {
    throw new Error(`Prepared Prisma migrations root contains a non-directory migration entry in ${prismaMigrationsRoot}.`);
  }
}

function runNodeCommand(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: workspaceDir,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with ${signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`}.`));
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function canWaitForDatabase() {
  return Boolean(databaseConnectionInfo.host && databaseConnectionInfo.port);
}

function trySocketConnection() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(
      {
        host: databaseConnectionInfo.host,
        port: databaseConnectionInfo.port,
      },
      () => {
        socket.end();
        resolve();
      },
    );

    socket.setTimeout(5000);
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy(new Error("Timed out while waiting for the database socket."));
    });
  });
}

async function waitForDatabaseAvailability() {
  if (!canWaitForDatabase()) {
    return;
  }

  const attempts = 30;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await trySocketConnection();
      console.log(
        `Database socket is reachable at ${databaseConnectionInfo.host}:${databaseConnectionInfo.port} for ${databaseSelection.provider}.`,
      );
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(
          `Database did not become reachable at ${databaseConnectionInfo.host}:${databaseConnectionInfo.port} after ${attempts} attempts.`,
          { cause: error },
        );
      }

      console.log(
        `Waiting for ${databaseSelection.provider} database at ${databaseConnectionInfo.host}:${databaseConnectionInfo.port} (${attempt}/${attempts})...`,
      );
      await wait(2000);
    }
  }
}

async function main() {
  await ensureStartupDirectories();
  await runNodeCommand([path.join(workspaceDir, "scripts", "prisma-provider.mjs"), "generate"], "Prisma generate");
  await waitForDatabaseAvailability();
  await prepareProviderMigrations();

  await runNodeCommand(
    [path.join(workspaceDir, "scripts", "prisma-provider.mjs"), "migrate", "deploy"],
    "Prisma migrate deploy",
  );

  await runNodeCommand([path.join(workspaceDir, "scripts", "bootstrap.mjs")], "Application bootstrap");

  if (process.env.IT_ASSETS_SKIP_SERVER_START === "1") {
    console.log("Startup initialization completed. Server start skipped by IT_ASSETS_SKIP_SERVER_START=1.");
    return;
  }

  const server = spawn(process.execPath, [path.join(workspaceDir, "server.js")], {
    cwd: workspaceDir,
    env: process.env,
    stdio: "inherit",
  });

  const forwardSignal = (signal) => {
    if (!server.killed) {
      server.kill(signal);
    }
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  server.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
