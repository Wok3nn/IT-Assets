import { mkdir } from "node:fs/promises";
import path from "node:path";

const appDataDir = process.env.APP_DATA_DIR ?? path.join(process.cwd(), "data");
const stateDir = path.join(appDataDir, "state");

export const appDataPaths = {
  root: appDataDir,
  stateDir,
  setup: path.join(stateDir, "setup.json"),
  users: path.join(stateDir, "users.json"),
  sessions: path.join(stateDir, "sessions.json"),
};

export async function ensureAppDataDirs() {
  await mkdir(appDataPaths.root, { recursive: true });
  await mkdir(stateDir, { recursive: true });
}

