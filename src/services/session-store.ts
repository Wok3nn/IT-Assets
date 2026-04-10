import { randomBytes, randomUUID } from "node:crypto";

import { getSessionTimeoutMinutes } from "@/modules/settings/settings.service";
import { db } from "@/services/database";

export const SESSION_COOKIE_NAME = "it_asset_tracker_session";
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
    await db.session.delete({
      where: {
        id: session.id,
      },
    });

    return null;
  }

  const timeoutMinutes = await getSessionTimeoutMinutes();
  const refreshedSession = await db.session.update({
    where: {
      id: session.id,
    },
    data: {
      expiresAt: new Date(Date.now() + timeoutMinutes * MINUTE_MS),
    },
  });

  return mapSession(refreshedSession);
}

export async function deleteSessionByToken(token: string) {
  await db.session.deleteMany({
    where: {
      token,
    },
  });
}

