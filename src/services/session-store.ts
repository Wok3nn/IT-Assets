import { randomBytes, randomUUID } from "node:crypto";

import { db } from "@/services/database";

export const SESSION_COOKIE_NAME = "it_asset_tracker_session";

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
  const session = await db.session.create({
    data: {
      id: randomUUID(),
      token: randomBytes(24).toString("hex"),
      userId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
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

  return mapSession(session);
}

export async function deleteSessionByToken(token: string) {
  await db.session.deleteMany({
    where: {
      token,
    },
  });
}

