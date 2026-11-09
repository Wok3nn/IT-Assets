"use client";

import { Check, Database, LoaderCircle, Palette, ShieldUser } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SetupWizardShell } from "@/components/layout/setup-wizard-shell";
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

export default function SetupWizardPage() {
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
    <SetupWizardShell steps={steps}>
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
                  placeholder="user@example.com"
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
    </SetupWizardShell>
  );
}
