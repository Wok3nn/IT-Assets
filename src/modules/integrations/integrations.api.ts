import "server-only";
import { z } from "zod";
import { db } from "@/services/database";
import { logger } from "@/services/logger";
import { ASSIGNMENT_SCOPE, identitySchema } from "./integrations.shared";
import { createIntegrationLimiter, identityKey, matchesIntegrationToken, parseIntegrationAuthorization } from "./integration-security";
import { integrationPrefix, readIntegrationConfig } from "./integrations.service";

const limitRequest = createIntegrationLimiter();
const querySchema = z.object({
  type: z.enum(["entra", "local"]), id: z.string().max(80), tenantId: z.string().max(36).optional(),
  after: z.string().cuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });
}
function failure(code: string, status: number, extra?: Record<string, string>) {
  return json({ error: { code } }, status, extra);
}

export async function handleAssignedAssetsRequest(request: Request) {
  const admission = limitRequest("anonymous");
  if (!admission.allowed) return failure("rate_limited", 429, { "Retry-After": String(admission.retryAfter) });
  const credential = parseIntegrationAuthorization(request.headers.get("authorization"));
  if (!credential) return failure("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
  try {
    const config = await readIntegrationConfig(credential.id);
    if (!matchesIntegrationToken(credential.token, config.tokenHash) || !(Date.parse(config.expiresAt ?? "") > Date.now())) {
      return failure("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
    const rate = limitRequest(credential.id);
    if (!rate.allowed) return failure("rate_limited", 429, { "Retry-After": String(rate.retryAfter) });
    if (config.enabled !== "true" || config.scope !== ASSIGNMENT_SCOPE) return failure("forbidden", 403);
    const params = new URL(request.url).searchParams;
    if (Array.from(params.keys()).some((key) => params.getAll(key).length !== 1)) return failure("invalid_request", 400);
    const query = querySchema.safeParse(Object.fromEntries(params));
    if (!query.success) return failure("invalid_request", 400);
    const identity = identitySchema.safeParse(query.data);
    if (!identity.success || (identity.data.type === "local" && query.data.tenantId)) return failure("invalid_request", 400);
    const userId = config[`grant.${identityKey(identity.data)}`];
    if (!userId) return failure("not_found", 404);
    const result = await db.$transaction(async (tx) => {
      const setup = await tx.setupState.findFirst({ orderBy: { createdAt: "asc" }, select: { isCompleted: true } });
      if (!setup?.isCompleted) return { unavailable: true } as const;
      const user = await tx.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
      if (!user) return null;
      const assets = await tx.asset.findMany({
        where: { assignedUserId: user.id, ...(query.data.after ? { id: { gt: query.data.after } } : {}) },
        select: { id: true, assetTag: true, name: true, make: true, model: true, status: { select: { key: true, name: true } } },
        orderBy: { id: "asc" }, take: query.data.limit + 1,
      });
      const hasMore = assets.length > query.data.limit;
      const page = assets.slice(0, query.data.limit);
      const key = integrationPrefix(credential.id) + "lastSuccessAt";
      const value = new Date().toISOString();
      await tx.setting.upsert({ where: { key }, create: { key, category: "integrations", value }, update: { value } });
      await tx.auditLog.create({ data: {
        action: "integration.assigned-assets.read", entityType: "Integration", entityId: credential.id,
        summary: `Integration ${credential.id}: read ${page.length} assigned assets.`,
        payloadJson: JSON.stringify({ userId, count: page.length }),
      } });
      return { identity: identity.data, assets: page, nextCursor: hasMore ? page.at(-1)!.id : null };
    }, { maxWait: 2000, timeout: 5000 });
    if (!result) return failure("not_found", 404);
    if ("unavailable" in result) return failure("unavailable", 503);
    return json(result);
  } catch {
    // Never log tokens, request URLs, database exceptions, or user identities.
    logger.warn("[integrations] Assigned-assets request failed.");
    return failure("unavailable", 503);
  }
}
