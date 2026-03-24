import { AppShell } from "@/components/navigation/app-shell";

export default function LabelsPage() {
  return (
    <AppShell>
      <div className="rounded-[32px] border border-[#ece7df] bg-white/92 p-6 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92">
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-100">Label Templates</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Template gallery, layout editor, and print preview placeholder.</p>
      </div>
    </AppShell>
  );
}


