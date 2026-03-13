import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { appDataPaths, ensureAppDataDirs } from "@/services/app-data";

export const SESSION_COOKIE_NAME = "it_asset_tracker_session";

export type StoredSession = {
  id: string;
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

async function readSessions() {
  try {
    const content = await readFile(appDataPaths.sessions, "utf8");
    return JSON.parse(content) as StoredSession[];
  } catch {
    return [];
  }
}

async function writeSessions(sessions: StoredSession[]) {
  await ensureAppDataDirs();
  await writeFile(appDataPaths.sessions, JSON.stringify(sessions, null, 2), "utf8");
}

export async function createSession(userId: string) {
  const sessions = await readSessions();
  const session: StoredSession = {
    id: randomUUID(),
    token: randomBytes(24).toString("hex"),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  };

  sessions.push(session);
  await writeSessions(sessions);

  return session;
}

export async function findSessionByToken(token: string) {
  const sessions = await readSessions();
  const session = sessions.find((item) => item.token === token) ?? null;

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  return session;
}

export async function deleteSessionByToken(token: string) {
  const sessions = await readSessions();
  const nextSessions = sessions.filter((item) => item.token !== token);
  await writeSessions(nextSessions);
}
