import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUser } from "@/lib/session";
import { SettingsPlaceholderPanel } from "@/modules/settings/components/settings-placeholder-panel";
import { readSetupState } from "@/services/setup-state";

export default async function ThemeSettingsPage() {
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
      <SettingsPlaceholderPanel description="Theme controls are staged here so the settings hub can scale cleanly without mixing future sections into the landing page." title="Theme Settings" />
    </AppShell>
  );
}
