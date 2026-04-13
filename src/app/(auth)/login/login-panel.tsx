"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppLogo } from "@/components/branding/app-logo";
import { TextField } from "@/components/forms/text-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type FormState = {
  email: string;
  password: string;
};

type LoginPanelProps = {
  branding: {
    lightLogoUrl: string;
    darkLogoUrl: string;
  };
  entraError?: string;
  entraSignInEnabled: boolean;
};

const initialState: FormState = {
  email: "",
  password: "",
};

function getEntraErrorMessage(error?: string) {
  if (!error) {
    return null;
  }

  if (error === "not-configured") {
    return "Microsoft Entra sign-in is not fully configured yet. Use local sign-in.";
  }

  if (error === "no-matching-user") {
    return "Microsoft Entra authenticated you, but no active local user with login access matched that account.";
  }

  if (error === "invalid-state" || error === "missing-code") {
    return "Microsoft Entra sign-in could not be validated. Try again.";
  }

  return "Microsoft Entra sign-in failed. Use local sign-in or check the provider configuration.";
}

export function LoginPanel({ branding, entraError, entraSignInEnabled }: LoginPanelProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const entraErrorMessage = getEntraErrorMessage(entraError);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
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
      };

      if (!response.ok) {
        setFormError(payload.message ?? "Unable to sign in.");
        return;
      }

      router.push(payload.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setFormError("Sign-in request failed. Check the server logs and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_22%),linear-gradient(180deg,#fcfcfd_0%,#f5f7fa_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.12),_transparent_24%),linear-gradient(180deg,#2f3437_0%,#2b3033_56%,#262b2d_100%)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <div className="w-full rounded-[32px] border border-[#e3d8ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.95)_100%)] p-8 shadow-panel backdrop-blur dark:border-[#50585c] dark:bg-[linear-gradient(180deg,rgba(58,63,67,0.96)_0%,rgba(50,55,59,0.98)_100%)] dark:shadow-[0_24px_50px_rgba(0,0,0,0.28)]">
          <div className="flex justify-center">
            <AppLogo
              className="h-20 w-20 drop-shadow-[0_18px_28px_rgba(15,23,42,0.12)] dark:drop-shadow-[0_20px_32px_rgba(0,0,0,0.28)]"
              darkSrc={branding.darkLogoUrl}
              lightSrc={branding.lightLogoUrl}
              priority
            />
          </div>

          <p className="mt-7 text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Login</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">
            Access your workspace
          </h1>

          {entraSignInEnabled ? (
            <div className="mt-7 space-y-3">
              <Link
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white/88 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-[#fff5ea] hover:text-[#b56613] hover:ring-1 hover:ring-[#F69629]/35 dark:border-[#4a5257] dark:bg-[#3a4043] dark:text-slate-100 dark:hover:bg-[#464d50] dark:hover:text-[#ffd1a0]"
              href="/api/auth/entra/start"
            >
              Sign in with Microsoft Entra
            </Link>
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                <span className="h-px flex-1 bg-slate-200 dark:bg-[#4b5255]" />
                <span>or local sign-in</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-[#4b5255]" />
              </div>
            </div>
          ) : null}

          {entraErrorMessage ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
              {entraErrorMessage}
            </p>
          ) : null}

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <TextField
              placeholder="Admin email"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
            <TextField
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
            />
            {formError ? <p className="text-sm text-rose-600 dark:text-rose-300">{formError}</p> : null}
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Signing in
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-6 text-sm text-slate-600 dark:text-slate-300">
            First run not completed?{" "}
            <Link
              className="font-medium text-[#c06d13] hover:text-[#F69629] dark:text-[#ffbf78] dark:hover:text-[#ffd5a7]"
              href="/setup"
            >
              Launch setup
            </Link>
          </div>

          <div className="mt-6 flex justify-start border-t border-slate-200/80 pt-4 dark:border-[#4f575b]">
            <ThemeToggle collapsed />
          </div>
        </div>
      </div>
    </main>
  );
}
