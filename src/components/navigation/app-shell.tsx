import { cookies } from "next/headers";

import { getCurrentUserRoleKeys } from "@/lib/session.server";
import { getAppShellBrandingSettings } from "@/modules/settings/settings.service";
import { getVisibleNavigationIdsForRoleKeys } from "@/modules/settings/permissions.service";

import { AppShellClient } from "./app-shell.client";

const SIDEBAR_COOKIE_KEY = "app-shell-sidebar-collapsed";

export async function AppShellRoot({ children }: { children: React.ReactNode }) {
  const [roleKeys, shellBranding, cookieStore] = await Promise.all([
    getCurrentUserRoleKeys(),
    getAppShellBrandingSettings(),
    cookies(),
  ]);
  const visibleNavItemIds = await getVisibleNavigationIdsForRoleKeys(roleKeys);
  const initialSidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE_KEY)?.value === "true";

  return (
    <AppShellClient
      appTitle={shellBranding.appTitle}
      branding={shellBranding.branding}
      initialSidebarCollapsed={initialSidebarCollapsed}
      visibleNavItemIds={visibleNavItemIds}
    >
      {children}
    </AppShellClient>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
