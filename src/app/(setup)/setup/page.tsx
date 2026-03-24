"use client";

import { Check, Database, LoaderCircle, Palette, ShieldUser } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type FormState = {
  siteName: string;
  adminEmail: string;
  password: string;
  confirmPassword: string;
};

const steps = [
  {
    title: "Create admin account",
    description: "Bootstrap the first local super admin for the workspace.",
    icon: ShieldUser,
  },
  {
    title: "Configure branding",
    description: "Set the application name, logo, and initial visual theme.",
    icon: Palette,
  },
  {
    title: "Initialize workspace",
    description: "Prepare server-side state and mark the instance ready for sign-in.",
    icon: Database,
  },
];

const initialState: FormState = {
  siteName: "",
  adminEmail: "",
  password: "",
  confirmPassword: "",
};

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (form.siteName.trim().length < 2) {
      nextErrors.siteName = "Enter the organization or site name used in the app branding.";
    }

    if (!/^\S+@\S+\.\S+$/.test(form.adminEmail.trim())) {
      nextErrors.adminEmail = "Enter a valid admin email address.";
    }

    if (form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        message?: string;
        redirectTo?: string;
        errors?: Record<string, string[]>;
      };

      if (!response.ok) {
        if (payload.errors) {
          setErrors({
            siteName: payload.errors.siteName?.[0],
            adminEmail: payload.errors.adminEmail?.[0],
            password: payload.errors.password?.[0],
            confirmPassword: payload.errors.confirmPassword?.[0],
          });
        }
        setFormError(payload.message ?? "Initialization failed.");
        return;
      }

      setForm(initialState);
      setSuccessMessage("Workspace initialized. Redirecting to login...");
      window.setTimeout(() => {
        router.push(payload.redirectTo ?? "/login");
        router.refresh();
      }, 600);
    } catch {
      setFormError("Initialization request failed. Check server logs and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_24%),linear-gradient(180deg,#fcfcfd_0%,#f5f7fa_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.12),_transparent_28%),linear-gradient(180deg,#2f3437_0%,#2b3033_56%,#262b2d_100%)]">
      <div className="mx-auto max-w-6xl rounded-[40px] border border-white/70 bg-[rgba(255,255,255,0.9)] p-6 shadow-panel backdrop-blur dark:border-[#464d50] dark:bg-[#3a4043]/88 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              First-run setup
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-[#fff3e4]">
              Bring the platform online in a few guided steps.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-200">
              The setup wizard creates the first local admin and stores the application name used across the interface.
            </p>
            <div className="mt-8 grid gap-4">
              {steps.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-3xl border border-[#f4dcc0] bg-[rgba(255,255,255,0.78)] p-5 dark:border-[#4a5257] dark:bg-[#41484c]/88"
                >
                  <div className="rounded-2xl bg-[rgba(246,150,41,0.14)] p-3 text-[#F69629] dark:bg-[rgba(246,150,41,0.18)] dark:text-[#ffbf78]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-slate-950 dark:text-[#fff3e4]">{title}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-[32px] border border-[#f1c998] bg-[linear-gradient(180deg,#ffb45b_0%,#f69629_100%)] p-6 text-white shadow-[0_20px_50px_rgba(246,150,41,0.28)] dark:border-[#51595d] dark:bg-[#363c3f]">
            <h2 className="text-2xl font-semibold text-white dark:text-[#fff3e4]">Setup wizard</h2>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-white dark:text-[#fff3e4]">
                  Organization / site name
                </label>
                <input
                  className="w-full rounded-2xl border border-white/20 bg-white/14 px-4 py-3 text-white placeholder:text-white/75 outline-none transition focus:border-white/40 focus:bg-white/18 dark:border-[#596166] dark:bg-[#2f3437] dark:text-[#fff3e4] dark:placeholder:text-slate-400 dark:focus:border-[#F69629]/55"
                  placeholder="Example: Northwind Asset Operations"
                  value={form.siteName}
                  onChange={(event) => updateField("siteName", event.target.value)}
                />
                <p className="mt-2 text-xs text-white/80 dark:text-slate-300">
                  This is the name shown in the app header, settings, and labels. It is not the admin display name.
                </p>
                {errors.siteName ? <p className="mt-2 text-xs text-rose-200">{errors.siteName}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white dark:text-[#fff3e4]">
                  Admin email
                </label>
                <input
                  className="w-full rounded-2xl border border-white/20 bg-white/14 px-4 py-3 text-white placeholder:text-white/75 outline-none transition focus:border-white/40 focus:bg-white/18 dark:border-[#596166] dark:bg-[#2f3437] dark:text-[#fff3e4] dark:placeholder:text-slate-400 dark:focus:border-[#F69629]/55"
                  placeholder="admin@example.com"
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) => updateField("adminEmail", event.target.value)}
                />
                {errors.adminEmail ? <p className="mt-2 text-xs text-rose-200">{errors.adminEmail}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white dark:text-[#fff3e4]">
                  Password
                </label>
                <input
                  className="w-full rounded-2xl border border-white/20 bg-white/14 px-4 py-3 text-white placeholder:text-white/75 outline-none transition focus:border-white/40 focus:bg-white/18 dark:border-[#596166] dark:bg-[#2f3437] dark:text-[#fff3e4] dark:placeholder:text-slate-400 dark:focus:border-[#F69629]/55"
                  placeholder="At least 8 characters"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                {errors.password ? <p className="mt-2 text-xs text-rose-200">{errors.password}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white dark:text-[#fff3e4]">
                  Confirm password
                </label>
                <input
                  className="w-full rounded-2xl border border-white/20 bg-white/14 px-4 py-3 text-white placeholder:text-white/75 outline-none transition focus:border-white/40 focus:bg-white/18 dark:border-[#596166] dark:bg-[#2f3437] dark:text-[#fff3e4] dark:placeholder:text-slate-400 dark:focus:border-[#F69629]/55"
                  placeholder="Re-enter password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => updateField("confirmPassword", event.target.value)}
                />
                {errors.confirmPassword ? <p className="mt-2 text-xs text-rose-200">{errors.confirmPassword}</p> : null}
              </div>

              <div className="rounded-2xl border border-white/16 bg-white/10 p-4 text-sm text-white/90 dark:border-[#4f575b] dark:bg-[#2f3437] dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-white dark:text-[#F69629]" />
                  <span>Setup now writes server-side state under /data for the containerized install.</span>
                </div>
              </div>

              {formError ? <p className="text-sm text-rose-200">{formError}</p> : null}
              {successMessage ? <p className="text-sm text-emerald-100 dark:text-emerald-300">{successMessage}</p> : null}

              <Button className="w-full" disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Initializing workspace
                  </span>
                ) : (
                  "Initialize workspace"
                )}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}


