import { AppShell } from "@/components/navigation/app-shell";

export default function LabelsPage() {
  return (
    <AppShell>
      <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-950">Label Templates</h1>
        <p className="mt-3 text-slate-600">Template gallery, layout editor, and print preview placeholder.</p>
      </div>
    </AppShell>
  );
}
