import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { getCurrentUser } from "@/lib/session";
import { readSetupState } from "@/services/setup-state";

const stats = [
  { title: "Total assets", value: "0", hint: "Ready for the first tracked records" },
  { title: "Assigned", value: "0", hint: "Assignments will appear here" },
  { title: "Maintenance", value: "0", hint: "No service events yet" },
  { title: "Templates", value: "0", hint: "Create the first label layout" },
];

export default async function DashboardPage() {
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
      <div className="space-y-6">
        <section className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Overview</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            {setupState.siteName}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Signed in as {currentUser.email}. The dashboard shell is live and backed by server-side setup and local authentication.
          </p>
          <form action="/api/auth/logout" className="mt-6" method="post">
            <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800" type="submit">
              Sign out
            </button>
          </form>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </section>
      </div>
    </AppShell>
  );
}
