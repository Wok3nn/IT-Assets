import { redirect } from "next/navigation";

import { HeaderAssetSearch } from "@/components/layout/header-asset-search";
import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { canManageSettings } from "@/lib/permissions";
import { getCurrentUser, getCurrentUserRoleKeys } from "@/lib/session";
import { SettingsNavCard } from "@/modules/settings/components/settings-nav-card";
import { readSetupState } from "@/services/setup-state";

const baseSettingsCards = [
  {
    href: "/settings/general",
    title: "General Settings",
    description: "Starting asset tag number and asset status management now live in a dedicated settings page.",
  },
  {
    href: "/settings/theme",
    title: "Theme Settings",
    description: "Theme colors, light/dark defaults, and UI appearance controls are staged here for future expansion.",
    badge: "Planned",
  },
  {
    href: "/settings/labels",
    title: "Labels",
    description: "Open the label-template admin entry point, then move into the shared template library and editor flow.",
  },
  {
    href: "/settings/authentication",
    title: "Authentication Settings",
    description: "Authentication providers and future Entra configuration will live in their own dedicated settings surface.",
    badge: "Planned",
  },
  {
    href: "/settings/branding",
    title: "Branding Settings",
    description: "Site identity, logos, and organization branding controls are reserved here for future rollout.",
    badge: "Planned",
  },
  {
    href: "/settings/import-export",
    title: "Import / Export",
    description: "Open the dedicated CSV workspace for exports, file uploads, mapping, validation, and import confirmation.",
  },
];

export default async function SettingsPage() {
  const [setupState, currentUser, roleKeys] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserRoleKeys(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  const settingsCards = canManageSettings(roleKeys)
    ? [
        ...baseSettingsCards,
        {
          href: "/settings/reset",
          title: "Reset",
          description: "Open the dedicated admin-only reset surface for selective destructive cleanup and full app reset controls.",
          badge: "Restricted",
        },
      ]
    : baseSettingsCards;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero as="div">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-100">Settings</h1>
              <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
                Use the settings hub to move between focused configuration areas without mixing active forms and navigation on the same screen.
              </p>
            </div>
            <HeaderAssetSearch className="w-full xl:w-auto xl:flex-none" compact />
          </div>
        </PageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {settingsCards.map((card) => (
            <SettingsNavCard key={card.href} badge={card.badge} description={card.description} href={card.href} title={card.title} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
