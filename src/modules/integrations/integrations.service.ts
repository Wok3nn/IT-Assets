import "server-only";
import { z } from "zod";
import { db } from "@/services/database";
import { ASSIGNMENT_SCOPE, INTEGRATIONS, identitySchema, integrationIdSchema, type IntegrationId, type IntegrationOverview } from "./integrations.shared";
import { createIntegrationToken, identityKey } from "./integration-security";

const category = "integrations";
export const integrationPrefix = (id: IntegrationId) => `integrations.${id}.`;
const transactionOptions = { maxWait: 2000, timeout: 5000 };

export async function readIntegrationConfig(id: IntegrationId) {
  const prefix = integrationPrefix(id);
  const rows = await db.setting.findMany({
    where: { category, key: { startsWith: prefix } }, select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((row) => [row.key.slice(prefix.length), row.value]));
}

export async function listIntegrationOverviews(): Promise<IntegrationOverview[]> {
  return Promise.all(INTEGRATIONS.map(async (definition) => {
    const [config, activity] = await Promise.all([
      readIntegrationConfig(definition.id),
      db.auditLog.findMany({ where: { entityType: "Integration", entityId: definition.id },
        select: { id: true, summary: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
    const configured = /^[a-f0-9]{64}$/.test(config.tokenHash ?? "");
    const expires = Date.parse(config.expiresAt ?? "");
    const enabled = config.enabled === "true";
    return {
      ...definition, enabled, credentialConfigured: configured,
      expiresAt: Number.isFinite(expires) ? new Date(expires).toISOString() : null,
      lastSuccessAt: config.lastSuccessAt ?? null,
      status: !configured ? "Not configured" : expires <= Date.now() || !Number.isFinite(expires) ? "Credential expired" :
        !enabled ? "Disabled" : config.lastSuccessAt ? "Last communication recorded" : "Awaiting first request",
      grants: Object.entries(config).filter(([key]) => key.startsWith("grant.")).map(([key, userId]) => ({
        key, userId, identity: key.slice("grant.".length),
      })),
      activity: activity.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    };
  }));
}

// Invoked only after the administrator guard in integrations.admin.server.ts.
export async function configureIntegration(input: { id: unknown; operation: unknown; actorUserId: string; identity?: unknown; userId?: unknown; grantKey?: unknown }) {
  const id = integrationIdSchema.parse(input.id);
  const operation = z.enum(["rotate", "revoke", "enable", "disable", "grant", "remove-grant"]).parse(input.operation);
  const actorUserId = z.string().cuid().parse(input.actorUserId);
  const prefix = integrationPrefix(id);
  const credential = operation === "rotate" ? createIntegrationToken(id) : null;
  await db.$transaction(async (tx) => {
    let auditPayload: Record<string, unknown> | undefined;
    const put = (key: string, value: string) => tx.setting.upsert({
      where: { key: prefix + key }, create: { category, key: prefix + key, value }, update: { category, value },
    });
    if (operation === "rotate") {
      await put("tokenHash", credential!.hash);
      await put("expiresAt", new Date(Date.now() + 90 * 86_400_000).toISOString());
      await put("scope", ASSIGNMENT_SCOPE);
      await put("enabled", "false");
      await tx.setting.deleteMany({ where: { key: prefix + "lastSuccessAt" } });
    } else if (operation === "revoke") {
      await put("enabled", "false");
      await tx.setting.deleteMany({ where: { key: { in: [prefix + "tokenHash", prefix + "expiresAt", prefix + "lastSuccessAt"] } } });
    } else if (operation === "enable") {
      const rows = await tx.setting.findMany({ where: { category, key: { startsWith: prefix } }, select: { key: true, value: true } });
      const config = Object.fromEntries(rows.map((row) => [row.key.slice(prefix.length), row.value]));
      if (!/^[a-f0-9]{64}$/.test(config.tokenHash ?? "") || !(Date.parse(config.expiresAt ?? "") > Date.now()) ||
          config.scope !== ASSIGNMENT_SCOPE || !Object.keys(config).some((key) => key.startsWith("grant."))) {
        throw new Error("Create a credential and approve at least one user before enabling this integration.");
      }
      await put("enabled", "true");
    } else if (operation === "disable") {
      await put("enabled", "false");
    } else if (operation === "grant") {
      const identity = identitySchema.parse(input.identity);
      const userId = z.string().cuid().parse(input.userId);
      if (identity.type === "local" && identity.id !== userId) throw new Error("Local identity must match the approved user ID.");
      const user = await tx.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
      if (!user) throw new Error("Choose an active application user.");
      const key = `grant.${identityKey(identity)}`;
      const previous = await tx.setting.findUnique({ where: { key: prefix + key }, select: { value: true } });
      auditPayload = { identity, userId, previousUserId: previous?.value ?? null };
      // Each scalar fits existing MariaDB Setting VARCHAR(191); no schema change.
      await put(key, userId);
    } else {
      const grantKey = z.string().max(170).regex(/^grant\.(entra\.[a-f0-9-]{36}\.[a-f0-9-]{36}|local\.c[a-z0-9]+)$/).parse(input.grantKey);
      const previous = await tx.setting.findUnique({ where: { key: prefix + grantKey }, select: { value: true } });
      auditPayload = { identityKey: grantKey.slice("grant.".length), previousUserId: previous?.value ?? null };
      await tx.setting.deleteMany({ where: { category, key: prefix + grantKey } });
    }
    await tx.auditLog.create({ data: {
      actorUserId, action: `integration.${operation}`, entityType: "Integration", entityId: id,
      summary: `Integration ${id}: ${operation}.`,
      payloadJson: auditPayload ? JSON.stringify(auditPayload) : undefined,
    } });
  }, transactionOptions);
  return credential?.token ?? null;
}
