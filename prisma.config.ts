import { defineConfig } from "prisma/config";
import { assertScriptDatabaseSelection } from "./scripts/database-selection.mjs";
import { loadProjectEnv } from "./scripts/load-env.mjs";

loadProjectEnv();
const selection = assertScriptDatabaseSelection();

export default defineConfig({
  schema: selection.schemaPath,
  migrations: {
    path: selection.providerMigrationsPath,
    seed: "node scripts/seed.js",
  },
});
