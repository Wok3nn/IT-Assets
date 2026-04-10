import "server-only";

import { cookies } from "next/headers";

import { findSessionByToken, SESSION_COOKIE_NAME } from "@/services/session-store";
import { db } from "@/services/database";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return findSessionByToken(token);
}

export async function getCurrentUser() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return db.user.findUnique({
    where: {
      id: session.userId,
    },
  });
}

export async function getCurrentUserRoleKeys() {
  const session = await getCurrentSession();

  if (!session) {
    return [];
  }

  const userRoles = await db.userRole.findMany({
    where: { userId: session.userId },
    select: { role: { select: { key: true } } },
  });

  return userRoles.map((userRole) => userRole.role.key);
}
