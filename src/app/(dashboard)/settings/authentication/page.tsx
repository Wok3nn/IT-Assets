import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUser } from "@/lib/session";
import { SettingsPlaceholderPanel } from "@/modules/settings/components/settings-placeholder-panel";
import { readSetupState } from "@/services/setup-state";

export default async function AuthenticationSettingsPage() {
  const [setupState, currentUser] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  return (
    <AppShell>
      <SettingsPlaceholderPanel description="Authentication providers and future Entra configuration will live here once that settings area is implemented." title="Authentication Settings" />
    </AppShell>
  );
}
