import Link from "next/link";

import { Button } from "@/components/ui/button";

type RoleCard = {
  id: string;
  key: string;
  name: string;
  totalUsers: number;
  activeUsers: number;
  loginEnabledUsers: number;
};

export function RoleCardsGrid({ roleCards, buildMemberHref }: { roleCards: RoleCard[]; buildMemberHref: (roleKey: string) => string }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 2xl:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
      {roleCards.map((role) => (
        <Link key={role.id} href={buildMemberHref(role.key)}>
          <article className="flex min-h-[220px] flex-col justify-between rounded-[28px] border border-[#ece7df] bg-white/96 p-5 transition hover:-translate-y-0.5 hover:border-[#f0c48d] hover:shadow-panel dark:border-[#4b5255] dark:bg-[#34393c] dark:shadow-[0_16px_30px_rgba(0,0,0,0.18)] dark:hover:border-[#f0a853]">
            <div className="space-y-4"><div><h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{role.name}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{role.key}</p></div><div className="space-y-1 text-sm text-slate-600 dark:text-slate-300"><p>{role.totalUsers} total user{role.totalUsers === 1 ? "" : "s"}</p><p>{role.activeUsers} active user{role.activeUsers === 1 ? "" : "s"}</p><p>{role.loginEnabledUsers} login-enabled user{role.loginEnabledUsers === 1 ? "" : "s"}</p></div></div>
            <div className="mt-6"><Button className="w-full" type="button" variant="secondary">Open role</Button></div>
          </article>
        </Link>
      ))}
    </div>
  );
}
