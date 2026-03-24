type StatCardProps = {
  title: string;
  value: string;
  hint: string;
};

export function StatCard({ title, value, hint }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-[#ece7df] bg-white/92 p-6 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/92">
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">{value}</p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{hint}</p>
    </div>
  );
}


