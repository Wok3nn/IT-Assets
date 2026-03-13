import { AppShell } from "@/components/navigation/app-shell";

export default function UsersPage() {
  return (
    <AppShell>
      <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-950">Users</h1>
        <p className="mt-3 text-slate-600">User CRUD, role assignment, and scope mapping placeholder.</p>
      </div>
    </AppShell>
  );
}
