import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_24%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <section className="rounded-[36px] border border-white/60 bg-white/75 p-8 shadow-panel backdrop-blur lg:p-12">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">
            IT-Asset-Tracker
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-slate-950">
            Asset management built like a modern product, not a legacy admin tool.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600">
            A polished self-hosted platform for assets, scopes, roles, branding,
            and label workflows.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/setup">
              <Button>Open setup</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary">Go to login</Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
