import { readFile, writeFile } from "node:fs/promises";

import { appDataPaths, ensureAppDataDirs } from "@/services/app-data";

export type SetupState = {
  isCompleted: boolean;
  siteName: string;
  initializedAt: string;
};

export async function readSetupState() {
  try {
    const content = await readFile(appDataPaths.setup, "utf8");
    return JSON.parse(content) as SetupState;
  } catch {
    return null;
  }
}

export async function writeSetupState(state: SetupState) {
  await ensureAppDataDirs();
  await writeFile(appDataPaths.setup, JSON.stringify(state, null, 2), "utf8");
}
