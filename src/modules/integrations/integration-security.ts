import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { integrationIdSchema, type IntegrationId, type IntegrationIdentity } from "./integrations.shared";

export function hashIntegrationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createIntegrationToken(id: IntegrationId) {
  const token = `iat_${id}_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashIntegrationToken(token) };
}

export function parseIntegrationAuthorization(header: string | null) {
  const match = /^Bearer (iat_([a-z]+)_[A-Za-z0-9_-]{43})$/i.exec(header ?? "");
  if (!match) return null;
  const id = integrationIdSchema.safeParse(match[2]);
  return id.success ? { id: id.data, token: match[1] } : null;
}

export function matchesIntegrationToken(token: string, hash: string | undefined) {
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(hashIntegrationToken(token), "hex"), Buffer.from(hash, "hex"));
}

export function identityKey(identity: IntegrationIdentity) {
  return identity.type === "entra" ? `entra.${identity.tenantId}.${identity.id}` : `local.${identity.id}`;
}

// Bounded keys supplied by the registry, never IP/header-controlled map keys.
// Per-process protection; the deployment edge must enforce a distributed limit.
export function createIntegrationLimiter() {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (key: "anonymous" | IntegrationId, now = Date.now()) => {
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + 60_000 };
      buckets.set(key, bucket);
    }
    const limit = key === "anonymous" ? 120 : 60;
    bucket.count += 1;
    return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  };
}
