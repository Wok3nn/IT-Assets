import { AppShell } from "@/components/navigation/app-shell";

const settingsCards = [
  "General Settings",
  "Theme Settings",
  "Branding Settings",
  "Authentication Settings",
  "Access Control",
  "Label Templates",
];

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur">
          <h1 className="text-3xl font-semibold text-slate-950">Settings</h1>
          <p className="mt-3 text-slate-600">
            Organized configuration panels instead of one oversized admin form.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {settingsCards.map((card) => (
            <div
              key={card}
              className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-panel backdrop-blur"
            >
              <h2 className="text-lg font-medium text-slate-950">{card}</h2>
              <p className="mt-2 text-sm text-slate-600">
                Module-specific configuration surface placeholder.
              </p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
