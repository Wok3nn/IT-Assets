import {
  getEntraAuthenticationConfig,
  isEntraAuthenticationConfigured,
} from "@/modules/settings/authentication-settings.service";
import { getBrandingSettings } from "@/modules/settings/settings.service";

import { LoginPanel } from "./login-panel";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const entraErrorParam = resolvedSearchParams?.entraError;
  const entraError = Array.isArray(entraErrorParam) ? entraErrorParam[0] : entraErrorParam;
  const [branding, entraConfig] = await Promise.all([
    getBrandingSettings(),
    getEntraAuthenticationConfig(),
  ]);

  return (
    <LoginPanel
      branding={branding}
      entraError={entraError}
      entraSignInEnabled={isEntraAuthenticationConfigured(entraConfig)}
    />
  );
}
