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

