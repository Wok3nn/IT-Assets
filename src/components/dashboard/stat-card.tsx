type StatCardProps = {
  title: string;
  value: string;
  hint: string;
};

export function StatCard({ title, value, hint }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
    </div>
  );
}
