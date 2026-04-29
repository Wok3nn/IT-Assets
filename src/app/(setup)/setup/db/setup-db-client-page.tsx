"use client";

import { CheckCircle2, Database, LoaderCircle, PlugZap, ServerCrash, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AppLogo } from "@/components/branding/app-logo";
import { FieldLabel, FieldLabelText } from "@/components/forms/field-label";
import { TextField } from "@/components/forms/text-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type FormState = {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
};

type ApiFailurePayload = {
  ok?: false;
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const initialFormState: FormState = {
  host: "",
  port: "1433",
  database: "",
  username: "",
  password: "",
};

const setupHighlights = [
  {
    title: "Connect to external SQL Server",
    description: "Store the server connection details required to bring Prisma online for this deployment.",
    icon: PlugZap,
  },
  {
    title: "Verify database readiness",
    description: "Test connectivity before any schema work starts so the app fails closed instead of partially initializing.",
    icon: ShieldCheck,
  },
  {
    title: "Initialize and continue",
    description: "Apply the SQL Server schema, seed baseline records, and continue into the normal workspace setup flow.",
    icon: Database,
  },
];

function normalizeFormPayload(form: FormState) {
  return {
    host: form.host.trim(),
    port: Number(form.port),
    database: form.database.trim(),
    username: form.username.trim(),
    password: form.password,
  };
}

function getFormFingerprint(form: FormState) {
  const normalized = normalizeFormPayload(form);
  return JSON.stringify(normalized);
}

function getFieldErrors(payload: ApiFailurePayload | null) {
  return {
    host: payload?.errors?.host?.[0],
    port: payload?.errors?.port?.[0],
    database: payload?.errors?.database?.[0],
    username: payload?.errors?.username?.[0],
    password: payload?.errors?.password?.[0],
  };
}

export default function DatabaseSetupClientPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [initializeError, setInitializeError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [testedFingerprint, setTestedFingerprint] = useState<string | null>(null);

  const currentFingerprint = useMemo(() => getFormFingerprint(form), [form]);
  const hasSuccessfulTest = testedFingerprint === currentFingerprint;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setTestError(null);
    setTestSuccess(null);
    setInitializeError(null);
  }

  function validateForm() {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.host.trim()) {
      nextErrors.host = "Enter the SQL Server host name or IP address.";
    }

    const parsedPort = Number(form.port);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      nextErrors.port = "Enter a valid SQL Server port between 1 and 65535.";
    }

    if (!form.database.trim()) {
      nextErrors.database = "Enter the target database name.";
    }

    if (!form.username.trim()) {
      nextErrors.username = "Enter the SQL Server username.";
    }

    if (!form.password) {
      nextErrors.password = "Enter the SQL Server password.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function readFailurePayload(response: Response) {
    try {
      return (await response.json()) as ApiFailurePayload;
    } catch {
      return null;
    }
  }

  async function handleTestConnection() {
    setTestError(null);
    setTestSuccess(null);
    setInitializeError(null);

    if (!validateForm()) {
      setTestedFingerprint(null);
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch("/api/setup/db/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizeFormPayload(form)),
      });

      const payload = await readFailurePayload(response);

      if (!response.ok) {
        setFieldErrors(getFieldErrors(payload));
        setTestedFingerprint(null);
        setTestError(payload?.message ?? "Connection test failed.");
        return;
      }

      setTestedFingerprint(currentFingerprint);
      setTestSuccess("Connection succeeded. The SQL Server target is reachable and ready for initialization.");
    } catch {
      setTestedFingerprint(null);
      setTestError("Connection test request failed. Check network reachability and try again.");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleInitialize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInitializeError(null);

    if (!validateForm()) {
      setTestedFingerprint(null);
      return;
    }

    if (!hasSuccessfulTest) {
      setInitializeError("Test the SQL Server connection successfully before continuing.");
      return;
    }

    setIsInitializing(true);

    try {
      const response = await fetch("/api/setup/db/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizeFormPayload(form)),
      });

      const payload = (await readFailurePayload(response)) as
        | (ApiFailurePayload & { redirectTo?: string; ok?: boolean })
        | null;

      if (!response.ok) {
        setFieldErrors(getFieldErrors(payload));
        setInitializeError(payload?.message ?? "Database initialization failed.");
        return;
      }

      router.push(payload?.redirectTo ?? "/setup");
      router.refresh();
    } catch {
      setInitializeError("Database initialization request failed. Check server availability and try again.");
    } finally {
      setIsInitializing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.08),_transparent_24%),linear-gradient(180deg,#fcfcfd_0%,#f5f7fa_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,_rgba(246,150,41,0.12),_transparent_28%),linear-gradient(180deg,#2f3437_0%,#2b3033_56%,#262b2d_100%)]">
      <div className="mx-auto max-w-6xl rounded-[40px] border border-white/70 bg-[rgba(255,255,255,0.92)] p-6 shadow-panel backdrop-blur dark:border-[#4a5256] dark:bg-[linear-gradient(180deg,rgba(63,68,72,0.94)_0%,rgba(54,59,63,0.92)_100%)] lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <section>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-[#f2c28c]/70 bg-[rgba(246,150,41,0.08)] dark:border-[#7f5a2d]/80 dark:bg-[rgba(246,150,41,0.12)]">
                <AppLogo className="h-12 w-12 drop-shadow-[0_12px_18px_rgba(246,150,41,0.16)] dark:drop-shadow-[0_14px_22px_rgba(0,0,0,0.24)]" />
              </div>
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-200">
              External database bootstrap
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-[#fff7ec]">
              Connect this deployment to SQL Server before app setup continues.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-100">
              Local mode is not used for this instance. Provide the external SQL Server connection details, verify access, then initialize the schema and continue into the normal workspace setup flow.
            </p>

            <div className="mt-8 grid gap-4">
              {setupHighlights.map(({ title, description, icon: Icon }) => (
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
            <div className="flex items-center gap-3 text-[#F69629] dark:text-[#ffbf78]">
              <Database className="h-6 w-6" />
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-200">SQL Server</p>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950 dark:text-[#fff3e4]">Database connection</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
              Passwords are submitted only to the bootstrap API and are never echoed back in the UI.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleInitialize}>
              <div className="grid gap-4 sm:grid-cols-[1.4fr_0.6fr]">
                <FieldLabel>
                  <FieldLabelText>Host</FieldLabelText>
                  <TextField
                    autoComplete="off"
                    placeholder="sqlserver.example.local"
                    value={form.host}
                    onChange={(event) => updateField("host", event.target.value)}
                  />
                  {fieldErrors.host ? <p className="text-xs text-rose-600 dark:text-rose-300">{fieldErrors.host}</p> : null}
                </FieldLabel>

                <FieldLabel>
                  <FieldLabelText>Port</FieldLabelText>
                  <TextField
                    inputMode="numeric"
                    placeholder="1433"
                    value={form.port}
                    onChange={(event) => updateField("port", event.target.value)}
                  />
                  {fieldErrors.port ? <p className="text-xs text-rose-600 dark:text-rose-300">{fieldErrors.port}</p> : null}
                </FieldLabel>
              </div>

              <FieldLabel>
                <FieldLabelText>Database</FieldLabelText>
                <TextField
                  autoComplete="off"
                  placeholder="IT_Assets"
                  value={form.database}
                  onChange={(event) => updateField("database", event.target.value)}
                />
                {fieldErrors.database ? <p className="text-xs text-rose-600 dark:text-rose-300">{fieldErrors.database}</p> : null}
              </FieldLabel>

              <FieldLabel>
                <FieldLabelText>Username</FieldLabelText>
                <TextField
                  autoComplete="username"
                  placeholder="it_assets_app"
                  value={form.username}
                  onChange={(event) => updateField("username", event.target.value)}
                />
                {fieldErrors.username ? <p className="text-xs text-rose-600 dark:text-rose-300">{fieldErrors.username}</p> : null}
              </FieldLabel>

              <FieldLabel>
                <FieldLabelText>Password</FieldLabelText>
                <TextField
                  autoComplete="current-password"
                  placeholder="SQL Server password"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                />
                {fieldErrors.password ? <p className="text-xs text-rose-600 dark:text-rose-300">{fieldErrors.password}</p> : null}
              </FieldLabel>

              <div className="rounded-2xl border border-[#ddc2a7] bg-white/82 p-4 text-sm text-slate-700 dark:border-[#4f575b] dark:bg-[#2b3033] dark:text-slate-200">
                <div className="flex items-start gap-3">
                  {hasSuccessfulTest ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <ServerCrash className="mt-0.5 h-4 w-4 shrink-0 text-[#F69629] dark:text-[#ffbf78]" />
                  )}
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {hasSuccessfulTest ? "Connection test passed" : "Test before initialization"}
                    </p>
                    <p>
                      {hasSuccessfulTest
                        ? "These exact values were verified successfully. If you change any field, test again before initializing."
                        : "Initialize stays locked until this exact connection is tested successfully."}
                    </p>
                  </div>
                </div>
              </div>

              {testError ? <p className="text-sm text-rose-600 dark:text-rose-300">{testError}</p> : null}
              {testSuccess ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{testSuccess}</p> : null}
              {initializeError ? <p className="text-sm text-rose-600 dark:text-rose-300">{initializeError}</p> : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="sm:flex-1"
                  disabled={isTesting || isInitializing}
                  onClick={handleTestConnection}
                  type="button"
                  variant="secondary"
                >
                  {isTesting ? (
                    <span className="flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Testing connection
                    </span>
                  ) : (
                    "Test connection"
                  )}
                </Button>

                <Button className="sm:flex-1" disabled={isTesting || isInitializing || !hasSuccessfulTest} type="submit">
                  {isInitializing ? (
                    <span className="flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Initializing database
                    </span>
                  ) : (
                    "Initialize and continue"
                  )}
                </Button>
              </div>
            </form>
          </section>
        </div>

        <div className="mt-6 flex justify-start border-t border-[#ebddcd] pt-4 dark:border-[#545c60]">
          <ThemeToggle collapsed />
        </div>
      </div>
    </main>
  );
}
