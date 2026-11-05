import { defineConfig } from "prisma/config";
const provider = process.env.DB_PROVIDER;
if (provider !== "sqlserver" && provider !== "mariadb")
  throw new Error("Explicit managed provider required.");
if (!process.env.DATABASE_URL) throw new Error("Explicit target required.");
export default defineConfig({
  schema: "prisma/providers/" + provider + "/schema.prisma",
  migrations: {
    path:
      (provider === "sqlserver"
        ? "prisma/managed-migrations/"
        : "prisma/migrations/") + provider,
  },
});
