import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";

import { getSessionTimeoutMinutes } from "@/modules/settings/settings.service";
import { db } from "@/services/database";

export const SESSION_COOKIE_NAME = "it_asset_tracker_session" + (process.env.IT_ASSETS_MANAGED === "1" ? "_" + process.env.IT_ASSETS_COOKIE_REALM + "_" + process.env.IT_ASSETS_REVISION : "");
export const SESSION_EFFECTIVE_ROLES_COOKIE_NAME = "it_asset_tracker_session_roles" + (process.env.IT_ASSETS_MANAGED === "1" ? "_" + process.env.IT_ASSETS_COOKIE_REALM + "_" + process.env.IT_ASSETS_REVISION : "");
const MINUTE_MS = 60 * 1000;

export type StoredSession = {
  id: string;
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

function mapSession(session: {
  id: string;
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}) {
  return {
    id: session.id,
    token: session.token,
    userId: session.userId,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  } satisfies StoredSession;
}

function isRecordMissingError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function buildEffectiveRoleCookieSignature(payload: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "change-me").update(payload).digest("base64url");
}

export function createEffectiveRoleCookieValue(sessionToken: string, roleKeys: string[]) {
  const normalizedRoleKeys = Array.from(new Set(roleKeys.map((roleKey) => roleKey.trim()).filter(Boolean)));

  if (normalizedRoleKeys.length === 0) {
    return null;
  }

  const payload = Buffer.from(
    JSON.stringify({
      roleKeys: normalizedRoleKeys,
      token: sessionToken,
    }),
    "utf8",
  ).toString("base64url");
  const signature = buildEffectiveRoleCookieSignature(payload);

  return `${payload}.${signature}`;
}

export function readEffectiveRoleCookieValue(sessionToken: string, cookieValue: string | undefined) {
  if (!cookieValue) {
    return [];
  }

  const separatorIndex = cookieValue.lastIndexOf(".");

  if (separatorIndex <= 0) {
    return [];
  }

  const payload = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  const expectedSignature = buildEffectiveRoleCookieSignature(payload);

  if (signature.length !== expectedSignature.length) {
    return [];
  }

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return [];
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      roleKeys?: unknown;
      token?: unknown;
    };

    if (parsed.token !== sessionToken || !Array.isArray(parsed.roleKeys)) {
      return [];
    }

    return Array.from(new Set(parsed.roleKeys.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
  } catch {
    return [];
  }
}

export async function createSession(userId: string) {
  const timeoutMinutes = await getSessionTimeoutMinutes();
  const expiresAt = new Date(Date.now() + timeoutMinutes * MINUTE_MS);

  const session = await db.session.create({
    data: {
      id: randomUUID(),
      token: randomBytes(24).toString("hex"),
      userId,
      expiresAt,
    },
  });

  return mapSession(session);
}

export async function findSessionByToken(token: string) {
  const session = await db.session.findUnique({
    where: {
      token,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.deleteMany({
      where: {
        id: session.id,
      },
    });

    return null;
  }

  const timeoutMinutes = await getSessionTimeoutMinutes();
  try {
    const refreshedSession = await db.session.update({
      where: {
        id: session.id,
      },
      data: {
        expiresAt: new Date(Date.now() + timeoutMinutes * MINUTE_MS),
      },
    });

    return mapSession(refreshedSession);
  } catch (error) {
    if (isRecordMissingError(error)) {
      return null;
    }

    throw error;
  }
}

export async function deleteSessionByToken(token: string) {
  await db.session.deleteMany({
    where: {
      token,
    },
  });
}
