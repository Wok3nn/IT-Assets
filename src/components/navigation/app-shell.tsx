import { getCurrentUserRoleKeys } from "@/lib/session.server";
import { getAppShellBrandingSettings } from "@/modules/settings/settings.service";
import { getVisibleNavigationIdsForRoleKeys } from "@/modules/settings/permissions.service";

import { AppShellClient } from "./app-shell.client";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [roleKeys, shellBranding] = await Promise.all([
    getCurrentUserRoleKeys(),
    getAppShellBrandingSettings(),
  ]);
  const visibleNavItemIds = await getVisibleNavigationIdsForRoleKeys(roleKeys);

  return (
    <AppShellClient
      appTitle={shellBranding.appTitle}
      branding={shellBranding.branding}
      visibleNavItemIds={visibleNavItemIds}
    >
      {children}
    </AppShellClient>
  );
}
