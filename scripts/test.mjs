import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const database = process.argv.includes("--database");
const directory = database ? "tests/database" : "tests";
const files = readdirSync(directory).filter((file) => file.endsWith(".test.ts")).sort().map((file) => path.join(directory, file));
const result = spawnSync(process.execPath, [
  ...(database ? ["--conditions=react-server"] : []), "--import", "tsx", "--test", ...files,
], {
  stdio: "inherit",
  env: { ...process.env, TSX_TSCONFIG_PATH: path.resolve("tests/tsconfig.json") },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
