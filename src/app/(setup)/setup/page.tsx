"use client";

import { useState } from "react";
import { Check, Database, LoaderCircle, Palette, ShieldUser } from "lucide-react";
import { useRouter } from "next/navigation";

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
    description: "Prepare local storage and mark the instance ready for sign-in.",
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      window.localStorage.setItem(
        "it-asset-tracker.setup",
        JSON.stringify({
          isCompleted: true,
          siteName: form.siteName.trim(),
          adminEmail: form.adminEmail.trim(),
          initializedAt: new Date().toISOString(),
        }),
      );

      setSuccessMessage("Workspace initialized. Redirecting to login...");
      setForm(initialState);
      window.setTimeout(() => {
        router.push("/login");
      }, 500);
    } catch {
      setFormError("Initialization failed in the browser. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f1ea_0%,#eef6f6_48%,#dceff0_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl rounded-[40px] border border-white/70 bg-[rgba(255,252,248,0.82)] p-6 shadow-panel backdrop-blur lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
              First-run setup
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
              Bring the platform online in a few guided steps.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600">
              The setup wizard creates the first local admin and stores the application name used across the interface.
            </p>
            <div className="mt-8 grid gap-4">
              {steps.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-3xl border border-[#d9e3e3] bg-[rgba(255,255,255,0.72)] p-5"
                >
                  <div className="rounded-2xl bg-[#dff0ec] p-3 text-[#0f766e]">
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
          <section className="rounded-[32px] border border-[#0f3d3e]/15 bg-[#12363a] p-6 text-white shadow-[0_20px_50px_rgba(18,54,58,0.25)]">
            <h2 className="text-2xl font-semibold">Setup wizard</h2>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Organization / site name
                </label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none transition focus:border-[#5eead4]/50"
                  placeholder="Example: Northwind Asset Operations"
                  value={form.siteName}
                  onChange={(event) => updateField("siteName", event.target.value)}
                />
                <p className="mt-2 text-xs text-slate-300/80">
                  This is the name shown in the app header, settings, and labels. It is not the admin display name.
                </p>
                {errors.siteName ? <p className="mt-2 text-xs text-rose-300">{errors.siteName}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Admin email
                </label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none transition focus:border-[#5eead4]/50"
                  placeholder="admin@example.com"
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) => updateField("adminEmail", event.target.value)}
                />
                {errors.adminEmail ? <p className="mt-2 text-xs text-rose-300">{errors.adminEmail}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Password
                </label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none transition focus:border-[#5eead4]/50"
                  placeholder="At least 8 characters"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                {errors.password ? <p className="mt-2 text-xs text-rose-300">{errors.password}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Confirm password
                </label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none transition focus:border-[#5eead4]/50"
                  placeholder="Re-enter password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => updateField("confirmPassword", event.target.value)}
                />
                {errors.confirmPassword ? <p className="mt-2 text-xs text-rose-300">{errors.confirmPassword}</p> : null}
              </div>

              <div className="rounded-2xl border border-[#5eead4]/15 bg-white/5 p-4 text-sm text-slate-200">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#5eead4]" />
                  <span>Temporary setup state is stored locally until backend persistence is wired in.</span>
                </div>
              </div>

              {formError ? <p className="text-sm text-rose-300">{formError}</p> : null}
              {successMessage ? <p className="text-sm text-emerald-300">{successMessage}</p> : null}

              <Button
                className="w-full bg-[#d8f3ec] text-slate-950 hover:bg-[#c6ece2] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
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

