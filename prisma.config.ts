import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "prisma/config";

function loadDotEnvFile(envPath: string) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContents = fs.readFileSync(envPath, "utf8");

  for (const rawLine of envContents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnvFile(path.resolve(process.cwd(), ".env"));

export default defineConfig({
  schema: "prisma/providers/sqlite/schema.prisma",
  migrations: {
    path: "prisma/migrations/sqlite",
  },
});
