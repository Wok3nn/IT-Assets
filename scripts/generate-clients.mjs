import { spawnSync } from "node:child_process";
import path from "node:path";
// Generation is offline. Do not import deployment credentials for the managed client.
const cli = path.resolve("node_modules/prisma/build/index.js");
const sql = spawnSync(
  process.execPath,
  [cli, "generate", "--generator", "client", "--schema", "prisma/providers/sqlserver/schema.prisma"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DB_MODE: "external",
      DB_PROVIDER: "sqlserver",
      DATABASE_URL: "sqlserver://127.0.0.1:1;database=offline",
    },
  },
);
if (sql.status !== 0) process.exit(sql.status ?? 1);
const base = spawnSync(
  process.execPath,
  ["scripts/prisma-provider.mjs", "generate"],
  { stdio: "inherit" },
);
process.exit(base.status ?? 1);
