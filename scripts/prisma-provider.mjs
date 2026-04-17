import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { assertScriptDatabaseSelection } from "./database-selection.mjs";

const workspaceDir = path.resolve(import.meta.dirname, "..");
const prismaCliPath = path.join(workspaceDir, "node_modules", "prisma", "build", "index.js");
const selectedDatabase = assertScriptDatabaseSelection({ workspaceDir });
const migrationsRootPath = selectedDatabase.migrationsRootPath;
const stagedBackupPath = path.join(workspaceDir, "prisma", ".migrations-providers-backup");

function needsMigrationStage(args) {
  return args[0] === "migrate";
}

function withSelectedSchema(args) {
  if (args.some((arg) => arg === "--schema" || arg.startsWith("--schema="))) {
    return args;
  }

  return [...args, `--schema=${selectedDatabase.schemaPath}`];
}

async function copyDirectoryContents(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await fs.cp(sourcePath, targetPath, { recursive: true });
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

async function stageProviderMigrations() {
  try {
    await fs.access(stagedBackupPath);
    throw new Error(`Temporary Prisma migrations backup already exists at ${stagedBackupPath}`);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.rename(migrationsRootPath, stagedBackupPath);
  await fs.mkdir(migrationsRootPath, { recursive: true });
  await copyDirectoryContents(path.join(stagedBackupPath, selectedDatabase.provider), migrationsRootPath);
}

async function restoreProviderMigrations() {
  await fs.rm(migrationsRootPath, { recursive: true, force: true });
  await fs.rename(stagedBackupPath, migrationsRootPath);
}

function runPrisma(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prismaCliPath, ...args], {
      cwd: workspaceDir,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Prisma CLI exited from signal ${signal}`));
        return;
      }

      resolve(code ?? 0);
    });
  });
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const prismaArgs = withSelectedSchema(rawArgs);

  if (!needsMigrationStage(prismaArgs)) {
    process.exitCode = await runPrisma(prismaArgs);
    return;
  }

  await stageProviderMigrations();

  try {
    process.exitCode = await runPrisma(prismaArgs);
  } finally {
    await restoreProviderMigrations();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
