import "server-only";

import { spawn } from "node:child_process";
import { copyFile, cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

type RunNodeCommandOptions = {
  args: string[];
  env?: NodeJS.ProcessEnv;
  label: string;
  stdinText?: string;
};

function getWorkspaceDir() {
  return process.cwd();
}

function getPrismaCliPath() {
  return path.join(getWorkspaceDir(), "node_modules", "prisma", "build", "index.js");
}

export async function runNodeCommand({ args, env = process.env, label, stdinText }: RunNodeCommandOptions) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: getWorkspaceDir(),
      env,
      stdio: ["pipe", "inherit", "inherit"],
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with ${signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`}.`));
    });

    if (stdinText) {
      child.stdin.write(stdinText);
    }

    child.stdin.end();
  });
}

export async function prepareProviderMigrationsForRuntime({
  provider,
  prismaProviderName,
}: {
  provider: "sqlite" | "postgresql" | "mariadb" | "sqlserver";
  prismaProviderName: "sqlite" | "postgresql" | "mysql" | "sqlserver";
}) {
  const workspaceDir = getWorkspaceDir();
  const providerMigrationsPath = path.join(workspaceDir, "prisma", "migrations", provider);
  const providerMigrationsTargetPath = path.join(workspaceDir, "prisma", "providers", provider, "migrations");
  const providerEntries = await readdir(providerMigrationsPath, { withFileTypes: true });

  if (providerEntries.length === 0) {
    throw new Error(`No Prisma migrations found for provider "${provider}" in ${providerMigrationsPath}.`);
  }

  const hasMigrationLock = providerEntries.some((entry) => entry.isFile() && entry.name === "migration_lock.toml");
  const migrationDirectoryNames = providerEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  if (!hasMigrationLock) {
    throw new Error(`Prisma provider migrations for "${provider}" are missing migration_lock.toml in ${providerMigrationsPath}.`);
  }

  if (migrationDirectoryNames.length === 0) {
    throw new Error(`Prisma provider migrations for "${provider}" do not include any migration directories in ${providerMigrationsPath}.`);
  }

  await rm(providerMigrationsTargetPath, { recursive: true, force: true });
  await mkdir(providerMigrationsTargetPath, { recursive: true });

  await copyFile(
    path.join(providerMigrationsPath, "migration_lock.toml"),
    path.join(providerMigrationsTargetPath, "migration_lock.toml"),
  );

  await Promise.all(
    migrationDirectoryNames.map((directoryName) =>
      cp(path.join(providerMigrationsPath, directoryName), path.join(providerMigrationsTargetPath, directoryName), {
        recursive: true,
        force: true,
      }),
    ),
  );

  const preparedEntries = await readdir(providerMigrationsTargetPath, { withFileTypes: true });
  const preparedMigrationDirectories = preparedEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const preparedMigrationLockContents = await readFile(path.join(providerMigrationsTargetPath, "migration_lock.toml"), "utf8");
  const preparedMigrationLockProvider = preparedMigrationLockContents.match(/provider\s*=\s*"([^"]+)"/)?.[1] ?? "unknown";

  if (preparedMigrationLockProvider !== prismaProviderName) {
    throw new Error(
      `Prepared Prisma migrations target has provider "${preparedMigrationLockProvider}" in migration_lock.toml, expected "${prismaProviderName}".`,
    );
  }

  if (
    preparedMigrationDirectories.length !== migrationDirectoryNames.length ||
    preparedMigrationDirectories.some((directoryName, index) => directoryName !== migrationDirectoryNames[index])
  ) {
    throw new Error(
      `Prepared Prisma migrations target directories do not match provider "${provider}" migrations. Expected ${migrationDirectoryNames.join(", ")}, received ${preparedMigrationDirectories.join(", ")}.`,
    );
  }

  const preparedMigrationStats = await Promise.all(
    preparedMigrationDirectories.map(async (directoryName) => ({
      directoryName,
      stats: await stat(path.join(providerMigrationsTargetPath, directoryName)),
    })),
  );

  if (preparedMigrationStats.some(({ stats }) => !stats.isDirectory())) {
    throw new Error(`Prepared Prisma migrations target contains a non-directory migration entry in ${providerMigrationsTargetPath}.`);
  }

  return {
    migrationDirectories: preparedMigrationDirectories,
    migrationLockProvider: preparedMigrationLockProvider,
    targetPath: providerMigrationsTargetPath,
  };
}

export async function testDatabaseConnectionViaPrisma(databaseUrl: string) {
  await runNodeCommand({
    args: [getPrismaCliPath(), "db", "execute", `--url=${databaseUrl}`, "--stdin"],
    env: process.env,
    label: "Prisma DB connection test",
    stdinText: "SELECT 1;",
  });
}
