import { redirect } from "next/navigation";

import { requireBootstrapPage } from "@/lib/bootstrap.server";
import {
  getEntraAuthenticationConfig,
  isEntraAuthenticationConfigured,
} from "@/modules/settings/authentication-settings.service";
import { getBrandingSettings } from "@/modules/settings/settings.service";
import { logger } from "@/services/logger";

import { LoginPanel } from "./login-panel";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireBootstrapPage();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const entraErrorParam = resolvedSearchParams?.entraError;
  const entraError = Array.isArray(entraErrorParam) ? entraErrorParam[0] : entraErrorParam;
  let branding: Awaited<ReturnType<typeof getBrandingSettings>>;
  let entraConfig: Awaited<ReturnType<typeof getEntraAuthenticationConfig>>;

  try {
    [branding, entraConfig] = await Promise.all([
      getBrandingSettings(),
      getEntraAuthenticationConfig(),
    ]);
  } catch (error) {
    logger.warn("[bootstrap] Failed to load login page settings from Prisma.", error);
    logger.info("Routing to DB setup");
    redirect("/setup/db");
  }

  return (
    <LoginPanel
      branding={branding}
      entraError={entraError}
      entraSignInEnabled={isEntraAuthenticationConfigured(entraConfig)}
    />
  );
}
