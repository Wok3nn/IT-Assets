import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { deleteSessionByToken, findSessionByToken, SESSION_COOKIE_NAME } from "@/services/session-store";
import { db } from "@/services/database";

export const getCurrentSession = cache(async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return findSessionByToken(token);
});

export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const user = await db.user.findUnique({
    where: {
      id: session.userId,
    },
  });

  if (!user) {
    await deleteSessionByToken(session.token);
    return null;
  }

  return user;
});

export const getCurrentUserRoleKeys = cache(async function getCurrentUserRoleKeys() {
  const session = await getCurrentSession();

  if (!session) {
    return [];
  }

  const userRoles = await db.userRole.findMany({
    where: { userId: session.userId },
    select: { role: { select: { key: true } } },
  });

  return userRoles.map((userRole) => userRole.role.key);
});
