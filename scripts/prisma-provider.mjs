import path from "node:path";
import { spawn } from "node:child_process";

import { assertScriptDatabaseSelection } from "./database-selection.mjs";
import { loadProjectEnv } from "./load-env.mjs";

const workspaceDir = path.resolve(import.meta.dirname, "..");
loadProjectEnv(workspaceDir);
const prismaCliPath = path.join(workspaceDir, "node_modules", "prisma", "build", "index.js");
const selectedDatabase = assertScriptDatabaseSelection({ workspaceDir });

function withSelectedSchema(args) {
  if (args.some((arg) => arg === "--schema" || arg.startsWith("--schema="))) {
    return args;
  }

  return [...args, `--schema=${selectedDatabase.schemaPath}`];
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
  process.exitCode = await runPrisma(prismaArgs);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
