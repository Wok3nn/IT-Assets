import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const workspaceDir = process.cwd();
const appDataDir = (process.env.APP_DATA_DIR ?? "/data").trim() || "/data";
const databaseUrl = (process.env.DATABASE_URL ?? "file:/data/db/app.db").trim() || "file:/data/db/app.db";

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

  const sqlitePath = resolveSqliteDatabasePath(databaseUrl);

  if (sqlitePath) {
    await mkdir(path.dirname(sqlitePath), { recursive: true });
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

async function main() {
  await ensureStartupDirectories();

  await runNodeCommand(
    [path.join(workspaceDir, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy", "--schema", path.join(workspaceDir, "prisma", "schema.prisma")],
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
