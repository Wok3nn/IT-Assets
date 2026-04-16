import { NextResponse } from "next/server";

import { buildAppUrl } from "@/services/config";
import { deleteSessionByToken, SESSION_COOKIE_NAME, SESSION_EFFECTIVE_ROLES_COOKIE_NAME } from "@/services/session-store";

export async function POST(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")[1];

  if (token) {
    await deleteSessionByToken(token);
  }

  const response = NextResponse.redirect(buildAppUrl("/login"));
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    expires: new Date(0),
  });
  response.cookies.set({
    name: SESSION_EFFECTIVE_ROLES_COOKIE_NAME,
    value: "",
    path: "/",
    expires: new Date(0),
  });

  return response;
}

