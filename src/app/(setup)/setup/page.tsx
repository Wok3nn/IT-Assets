"use client";

import { Check, Database, LoaderCircle, Palette, ShieldUser } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppLogo } from "@/components/branding/app-logo";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { TextField } from "@/components/forms/text-field";
import { ThemeToggle } from "@/components/theme-toggle";
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
              Bring the platform online in a few guided steps.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-100">
              The setup wizard creates the first local admin and stores the application name used across the interface.
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
                    <h2 className="text-lg font-medium text-slate-950 dark:text-[#fff4e3]">{title}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-100">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-[#e6c49d] bg-[linear-gradient(180deg,rgba(255,246,235,0.99)_0%,rgba(250,236,217,0.98)_100%)] p-6 shadow-[0_20px_50px_rgba(246,150,41,0.16)] dark:border-[#596166] dark:bg-[linear-gradient(180deg,rgba(60,65,69,0.98)_0%,rgba(52,57,61,0.99)_100%)] dark:shadow-[0_24px_50px_rgba(0,0,0,0.3)]">
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-[#fff3e4]">Setup wizard</h2>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <FieldLabel>
                <FieldLabelText>Organization / site name</FieldLabelText>
                <TextField
                  placeholder="Example: Northwind Asset Operations"
                  value={form.siteName}
                  onChange={(event) => updateField("siteName", event.target.value)}
                />
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  This is the name shown in the app header, settings, and labels. It is not the admin display name.
                </p>
                {errors.siteName ? <p className="text-xs text-rose-600 dark:text-rose-300">{errors.siteName}</p> : null}
              </FieldLabel>

              <FieldLabel>
                <FieldLabelText>Admin email</FieldLabelText>
                <TextField
                  placeholder="admin@example.com"
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) => updateField("adminEmail", event.target.value)}
                />
                {errors.adminEmail ? <p className="text-xs text-rose-600 dark:text-rose-300">{errors.adminEmail}</p> : null}
              </FieldLabel>

              <FieldLabel>
                <FieldLabelText>Password</FieldLabelText>
                <TextField
                  placeholder="At least 8 characters"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                {errors.password ? <p className="text-xs text-rose-600 dark:text-rose-300">{errors.password}</p> : null}
              </FieldLabel>

              <FieldLabel>
                <FieldLabelText>Confirm password</FieldLabelText>
                <TextField
                  placeholder="Re-enter password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => updateField("confirmPassword", event.target.value)}
                />
                {errors.confirmPassword ? <p className="text-xs text-rose-600 dark:text-rose-300">{errors.confirmPassword}</p> : null}
              </FieldLabel>

              <div className="rounded-2xl border border-[#ddc2a7] bg-white/82 p-4 text-sm text-slate-700 dark:border-[#4f575b] dark:bg-[#2b3033] dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#F69629]" />
                  <span>Setup now writes server-side state under /data for the containerized install.</span>
                </div>
              </div>

              {formError ? <p className="text-sm text-rose-600 dark:text-rose-300">{formError}</p> : null}
              {successMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{successMessage}</p> : null}

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

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span>Already have an account?</span>
              <Link href="/login">
                <Button type="button" variant="secondary">
                  Login
                </Button>
              </Link>
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-start border-t border-[#ebddcd] pt-4 dark:border-[#545c60]">
          <ThemeToggle collapsed />
        </div>
      </div>
    </main>
  );
}
