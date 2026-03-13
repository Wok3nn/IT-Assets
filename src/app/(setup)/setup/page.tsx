import { Check, Database, Palette, ShieldUser } from "lucide-react";

import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "Create admin account",
    description: "Bootstrap the first local super admin for the workspace.",
    icon: ShieldUser,
  },
  {
    title: "Configure branding",
    description: "Set site name, upload a logo, and choose the initial theme.",
    icon: Palette,
  },
  {
    title: "Initialize database",
    description: "Prepare SQLite storage and seed system roles and statuses.",
    icon: Database,
  },
];

export default function SetupPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_45%,#dbeafe_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl rounded-[40px] border border-white/70 bg-white/75 p-6 shadow-panel backdrop-blur lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
              First-run setup
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
              Bring the platform online in a few guided steps.
            </h1>
            <div className="mt-8 grid gap-4">
              {steps.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-5"
                >
                  <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-slate-950">{title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-[32px] bg-slate-950 p-6 text-white">
            <h2 className="text-2xl font-semibold">Setup wizard</h2>
            <div className="mt-6 space-y-4">
              <input className="w-full rounded-2xl bg-white/10 px-4 py-3 text-white placeholder:text-slate-300" placeholder="Site name" />
              <input className="w-full rounded-2xl bg-white/10 px-4 py-3 text-white placeholder:text-slate-300" placeholder="Admin email" />
              <input className="w-full rounded-2xl bg-white/10 px-4 py-3 text-white placeholder:text-slate-300" placeholder="Password" type="password" />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>SQLite data stored under /data</span>
                </div>
              </div>
              <Button className="w-full bg-white text-slate-950 hover:bg-slate-100">
                Initialize workspace
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
