import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { isBootstrapComplete } from "@/services/bootstrap-config";
import { buildAppUrl } from "@/services/config";
import { logger } from "@/services/logger";

export const BOOTSTRAP_SETUP_PATH = "/setup/db";

export async function requireBootstrapPage() {
  const bootstrapComplete = await isBootstrapComplete();

  if (!bootstrapComplete) {
    logger.info("Routing to DB setup");
    redirect(BOOTSTRAP_SETUP_PATH);
  }
}

export async function getBootstrapRedirectResponse() {
  const bootstrapComplete = await isBootstrapComplete();

  if (bootstrapComplete) {
    return null;
  }

  logger.info("Routing to DB setup");
  return NextResponse.redirect(buildAppUrl(BOOTSTRAP_SETUP_PATH));
}

export async function getBootstrapJsonResponse(
  message = "Database setup is required before this action is available.",
  status = 409,
) {
  const bootstrapComplete = await isBootstrapComplete();

  if (bootstrapComplete) {
    return null;
  }

  logger.info("Routing to DB setup");
  return NextResponse.json({ error: message }, { status });
}
