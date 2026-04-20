import { redirect } from "next/navigation";

import { getBootstrapFailurePath, requireBootstrapPage } from "@/lib/bootstrap.server";
import { getCurrentUser } from "@/lib/session.server";
import { logger } from "@/services/logger";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireBootstrapPage();

  let setupState: Awaited<ReturnType<typeof readSetupState>>;

  try {
    setupState = await readSetupState();
  } catch (error) {
    logger.warn("[bootstrap] Failed to read application setup state from Prisma.", error);
    const fallbackPath = getBootstrapFailurePath();
    logger.info(`Routing to ${fallbackPath}`);
    redirect(fallbackPath);
  }

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  let currentUser: Awaited<ReturnType<typeof getCurrentUser>>;

  try {
    currentUser = await getCurrentUser();
  } catch (error) {
    logger.warn("[bootstrap] Failed to resolve current user during root routing.", error);
    const fallbackPath = getBootstrapFailurePath();
    logger.info(`Routing to ${fallbackPath}`);
    redirect(fallbackPath);
  }

  if (currentUser) {
    redirect("/dashboard");
  }

  redirect("/login");
}

