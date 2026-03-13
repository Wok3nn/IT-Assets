import { AppShell } from "@/components/navigation/app-shell";
import { StatCard } from "@/components/dashboard/stat-card";

const stats = [
  { title: "Total assets", value: "1,284", hint: "Across all enabled scopes" },
  { title: "Assigned", value: "932", hint: "Tracked against users and locations" },
  { title: "Maintenance", value: "46", hint: "Waiting on review or repair" },
  { title: "Templates", value: "8", hint: "Label layouts ready to print" },
];

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Overview</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Operational visibility with a cleaner workflow.
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            The dashboard is structured for quick triage, bulk navigation, and
            high-signal metrics instead of dense admin clutter.
          </p>
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
