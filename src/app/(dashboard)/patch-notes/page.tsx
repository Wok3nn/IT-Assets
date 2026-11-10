import { redirect } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUser } from "@/lib/session.server";
import { readSetupState } from "@/services/setup-state";
import { APP_VERSION, RELEASE_STATUS } from "@/lib/app-metadata";

export const dynamic = "force-dynamic";

const latestSections: { title: string; items: (string | { label: string; children: string[] })[] }[] = [
  {
    title: "Installation and databases",
    items: [
      "Microsoft SQL Server support alongside MariaDB database management.",
      "Unified first-run setup starts without an external database and uses a separate installation administrator.",
      "Database connection testing and schema verification distinguish empty, compatible and incompatible inventories.",
      "Safe activation and switching require exact database-name confirmation, compatibility checks and post-restart readiness verification.",
    ],
  },
  {
    title: "Interface improvements",
    items: [
      {
        label: "Clearer setup and database management",
        children: [
          "Enrollment-token instructions, aligned connection fields and MariaDB credential guidance.",
          "Compact workspace preparation, accessible help and activation confirmation dialogs.",
          "Original workspace sidebar retained during separate management authentication.",
        ],
      },
    ],
  },
];

const previousUpdates = [
  "Version v0.5.4",
  "Borrowed Items: borrow/return workflows, notifications, due-date and overdue reminders, and history tracking.",
  "Exchange Email settings: Microsoft Entra integration, reminder intervals and borrower/admin notifications.",
  "Version v0.5.3",
  "Fixes:",
  "Automatic make and model assignment added as a global Settings option",
  "Arrow-key navigation added when selecting users",
  "Assets can now be assigned from the User properties page",
  "Feature:",
  "Guest Users can now be added through the Roles tab",
  "Version v0.5.2",
  "Fixed Assets list check-in/check-out button state.",
  "Added Use category path for make/model to Edit Asset.",
  "Improved Assets list action buttons so row actions can be used without selecting the asset first, with clearer per-button hover states and better empty-space row selection.",
  "Added icon-only Edit pencil shortcut to the Assets list Actions column.",
  "Version v0.5.1",
  "Added icon-only copy button beside Serial number with copied confirmation",
  "Version v0.5.0",
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
          <p className="mt-4 text-sm font-semibold text-[#b56613] dark:text-[#ffd7ab]">Version: {APP_VERSION}</p>
          <p className="mt-2 text-sm">{RELEASE_STATUS}. Production migration, live SQL Server acceptance and Docker compatibility have not been validated for this release.</p>
          <div className="mt-5 space-y-5 text-sm text-slate-700 dark:text-slate-200">
            {latestSections.map((section) => (
              <section key={section.title}>
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">{section.title}</h2>
                <ul className="mt-3 space-y-2">
                  {section.items.map((item) => {
                    const label = typeof item === "string" ? item : item.label;

                    return (
                      <li key={label} className="grid gap-2">
                        <div className="flex gap-2">
                          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F69629]" />
                          <span>{label}</span>
                        </div>
                        {typeof item === "string" ? null : (
                          <ul className="ml-5 space-y-1.5 text-slate-600 dark:text-slate-300">
                            {item.children.map((child) => (
                              <li key={child} className="flex gap-2">
                                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F69629]/70" />
                                <span>{child}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <details className="mt-7 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 dark:border-[#4b5255] dark:bg-[#353b3f]">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 marker:text-[#F69629] dark:text-slate-200">
              Previous patch notes
            </summary>
            <ul className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-[#4b5255] dark:text-slate-300">
              {previousUpdates.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F69629]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </details>
        </PageHero>
      </div>
    </AppShell>
  );
}
