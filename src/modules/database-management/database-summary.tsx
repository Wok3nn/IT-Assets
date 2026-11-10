import type { PublicProfile } from "./control-store";

export function DatabaseSummary({ profile, active }: { profile: PublicProfile; active: boolean }) {
  const entries = [
    ["Database type", profile.provider === "sqlserver" ? "Microsoft SQL Server" : "MariaDB"],
    ["Database hostname", profile.host],
    ["Database name", profile.database],
    ["Database port", String(profile.port)],
    ["Activation state", active ? "Active selection" : "Inactive"],
  ];
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">
    {entries.map(([label, value]) => <div key={label} className="min-w-0">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>)}
  </dl>;
}
