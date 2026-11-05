import { PrismaClient } from "@prisma/client";
import { PrismaClient as SqlServerClient } from "@it-assets/sqlserver-client";
import { profileSchema, type Profile } from "./control-store";

export function connectionUrl(input: Profile) {
  const p = profileSchema.parse(input);
  if (p.provider === "sqlserver")
    return `sqlserver://${p.host}:${p.port};database={${p.database}};user={${p.username}};password={${p.password}};encrypt=true;trustServerCertificate=${p.trustCertificate};connectionTimeout=5;schema=dbo`;
  return `mysql://${encodeURIComponent(p.username)}:${encodeURIComponent(p.password)}@${p.host}:${p.port}/${encodeURIComponent(p.database)}?connect_timeout=5`;
}
export function createProfileClient(profile: Profile): PrismaClient {
  const options = { datasources: { db: { url: connectionUrl(profile) } } };
  // The generated clients have the same domain models but different connectors.
  return profile.provider === "sqlserver"
    ? (new SqlServerClient(options) as unknown as PrismaClient)
    : new PrismaClient(options);
}
