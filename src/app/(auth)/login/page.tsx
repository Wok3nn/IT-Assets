import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4">
      <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-panel backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Login</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          Access your workspace
        </h1>
        <div className="mt-8 space-y-4">
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
            placeholder="Email"
          />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
            placeholder="Password"
            type="password"
          />
          <Button className="w-full">Sign in</Button>
        </div>
        <div className="mt-6 text-sm text-slate-600">
          First run not completed?{" "}
          <Link className="font-medium text-slate-900" href="/setup">
            Launch setup
          </Link>
        </div>
      </div>
    </main>
  );
}
