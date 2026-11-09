import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";
export function SetupWizardShell({
  children,
  steps,
  title = "Bring the platform online in a few guided steps.",
  description = "The setup wizard creates the first local admin and stores the application name used across the interface.",
}: {
  children?: ReactNode;
  steps: { title: string; description: string; icon: LucideIcon }[];
  title?: string;
  description?: string;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_24%),linear-gradient(180deg,#fcfcfd_0%,#f5f7fa_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.12),_transparent_28%),linear-gradient(180deg,#2f3437_0%,#2b3033_56%,#262b2d_100%)]">
      <div className="mx-auto max-w-6xl rounded-[40px] border border-white/70 bg-[rgba(255,255,255,0.92)] p-6 shadow-panel backdrop-blur dark:border-[#4a5256] dark:bg-[linear-gradient(180deg,rgba(63,68,72,0.94)_0%,rgba(54,59,63,0.92)_100%)] lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-[#f2c28c]/70 bg-[rgba(246,150,41,0.08)] dark:border-[#7f5a2d]/80 dark:bg-[rgba(246,150,41,0.12)]">
                <AppLogo className="h-12 w-12 drop-shadow-[0_12px_18px_rgba(246,150,41,0.16)] dark:drop-shadow-[0_14px_22px_rgba(0,0,0,0.24)]" />
              </div>
            </div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-200">
              First-run setup
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-[#fff7ec]">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-100">
              {description}
            </p>
            <div className="mt-8 grid gap-4">
              {steps.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-3xl border border-[#f1d8bc] bg-[rgba(255,255,255,0.8)] p-5 dark:border-[#596166] dark:bg-[linear-gradient(180deg,rgba(79,85,89,0.88)_0%,rgba(70,76,80,0.82)_100%)]"
                >
                  <div className="rounded-2xl bg-[rgba(246,150,41,0.14)] p-3 text-[#F69629] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffbf78]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-slate-950 dark:text-[#fff4e3]">
                      {title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-100">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-[#e6c49d] bg-[linear-gradient(180deg,rgba(255,246,235,0.99)_0%,rgba(250,236,217,0.98)_100%)] p-6 shadow-[0_20px_50px_rgba(246,150,41,0.16)] dark:border-[#596166] dark:bg-[linear-gradient(180deg,rgba(60,65,69,0.98)_0%,rgba(52,57,61,0.99)_100%)] dark:shadow-[0_24px_50px_rgba(0,0,0,0.3)]">
            {children}
          </section>
        </div>

        <div className="mt-6 flex justify-start border-t border-[#ebddcd] pt-4 dark:border-[#545c60]">
          <ThemeToggle collapsed />
        </div>
      </div>
    </main>
  );
}
