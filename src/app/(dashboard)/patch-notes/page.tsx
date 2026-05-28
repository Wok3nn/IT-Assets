import { redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { APP_VERSION } from "@/lib/app-metadata";
import { getCurrentUser } from "@/lib/session.server";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

const latestUpdates = [
  `Version ${APP_VERSION}`,
  "Cleaner asset view/edit layout",
  "Asset history moved below details",
  "Asset tag duplicate blocking",
  "New Patch Notes tab",
];

export default async function PatchNotesPage() {
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
      <div className="mx-auto w-full max-w-3xl">
        <PageHero>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Patch notes</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Latest update</h1>
          <ul className="mt-5 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {latestUpdates.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F69629]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </PageHero>
      </div>
    </AppShell>
  );
}
