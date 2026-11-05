import { spawnSync } from "node:child_process";
const env = {
  ...process.env,
  IT_ASSETS_MANAGED_BUILD: "1",
  DB_MODE: "local",
  DB_PROVIDER: "mariadb",
  DATABASE_URL: "mysql://offline:offline@127.0.0.1:1/offline",
};
for (const args of [
  ["scripts/generate-clients.mjs"],
  ["node_modules/next/dist/bin/next", "build"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
