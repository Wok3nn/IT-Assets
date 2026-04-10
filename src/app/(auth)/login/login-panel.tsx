"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppLogo } from "@/components/branding/app-logo";
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
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_22%),linear-gradient(180deg,#fcfcfd_0%,#f5f7fa_100%)] px-4 dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_24%),linear-gradient(180deg,#2f3437_0%,#2c3134_100%)]">
      <div className="w-full max-w-md rounded-[32px] border border-[#ece7df] bg-white/92 p-8 shadow-panel backdrop-blur dark:border-[#464c4f] dark:bg-[#383d40]/94">
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
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              <span className="h-px flex-1 bg-slate-200 dark:bg-[#4b5255]" />
              <span>or local sign-in</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-[#4b5255]" />
            </div>
          </div>
        ) : null}
        {entraErrorMessage ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">{entraErrorMessage}</p> : null}
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-100 dark:focus:border-[#F69629]/70"
            placeholder="Admin email"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#F69629]/70 dark:border-[#4b5255] dark:bg-[#2f3437] dark:text-slate-100 dark:focus:border-[#F69629]/70"
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
          <Link className="font-medium text-[#c06d13] hover:text-[#F69629] dark:text-[#ffbf78] dark:hover:text-[#ffd5a7]" href="/setup">
            Launch setup
          </Link>
        </div>
      </div>
    </main>
  );
}
