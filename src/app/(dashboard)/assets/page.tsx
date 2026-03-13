import { AppShell } from "@/components/navigation/app-shell";

export default function AssetsPage() {
  return (
    <AppShell>
      <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-950">Assets</h1>
        <p className="mt-3 text-slate-600">
          Searchable asset table, filters, drawers, and bulk actions will land here.
        </p>
      </div>
    </AppShell>
  );
}
