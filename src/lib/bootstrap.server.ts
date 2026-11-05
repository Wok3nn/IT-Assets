import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { readDatabaseConfig } from "@/services/database-config";
import { isBootstrapComplete } from "@/services/bootstrap-config";
import { buildAppUrl } from "@/services/config";
import { logger } from "@/services/logger";
import { control, managed, managementPath } from "@/modules/database-management/control-store";

export const BOOTSTRAP_SETUP_PATH = "/setup/db";
export const APP_SETUP_PATH = "/setup";

export function getBootstrapFailurePath() {
  if (managed()) return managementPath;
  const databaseConfig = readDatabaseConfig();

  if (databaseConfig.isSupportedCombination && databaseConfig.mode === "local") {
    return APP_SETUP_PATH;
  }

  return BOOTSTRAP_SETUP_PATH;
}

export async function requireBootstrapPage() {
  if (managed()) {
    if (!control().state().active) redirect(managementPath);
    return;
  }
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
