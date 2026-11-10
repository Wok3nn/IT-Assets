"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form } from "./action-form";
export function ReadinessPanel({
  active, organization, profile,
}: {
  active: boolean;
  organization: string;
  profile: string;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<{
    ready: boolean; verified?: boolean; message: string;
  }>({ ready: false, message: "Checking application readiness…" });
  useEffect(() => {
    if (!active) return;
    let stopped = false, count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setFinished(false);
    setResult({ ready: false, message: "Checking application readiness…" });
    const check = async () => {
      count++;
      let ready = false;
      const deadline = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/setup/status", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          window.location.replace("/setup");
          return;
        }
        if (!response.ok) throw new Error();
        const data = await response.json();
        ready = data.ready === true;
        if (!stopped) {
          setResult(data);
          if (ready) router.refresh();
        }
      } catch {
        if (!stopped) setResult({
          ready: false,
          message: "Readiness could not be confirmed. Wait for restart, then retry verification.",
        });
      } finally {
        clearTimeout(deadline);
      }
      if (stopped) return;
      if (ready || count >= 6 || controller.signal.aborted) setFinished(true);
      else timer = setTimeout(() => void check(), 5000);
    };
    void check();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, attempt, router]);
  return <section className="space-y-4" aria-live="polite">
    <h2 className="text-2xl font-semibold">{result.ready ? "Congratulations! IT Assets is ready." : "Review & Complete"}</h2>
    <p className="break-words text-sm">{organization} · {profile}</p>
    <ul aria-label="Setup checklist" className="space-y-3">
      {[
        [Boolean(organization), "Organization settings saved"],
        [true, "Installation administrator registered"],
        [Boolean(profile), "Database connection available"],
        [Boolean(result.verified), "Connection tested"],
        [Boolean(result.verified), "Database schema compatible"],
        [Boolean(result.verified), "Workspace initialized or existing compatible workspace detected"],
        [active, "Database activated"],
        [result.ready, "Application ready after restart"],
      ].map(([done, label]) => (
        <li key={String(label)} className={done ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"}>
          {done ? "✓" : "○"} {label}
        </li>
      ))}
    </ul>
    {!result.ready && <p role={finished ? "alert" : "status"} className="text-sm">{result.message}</p>}
    {result.ready ? (
      <Form op="exit">
        <input type="hidden" name="destination" value="inventory" />
        <Button type="submit">Go to IT Assets</Button>
      </Form>
    ) : finished && <Button type="button" onClick={() => setAttempt(x => x + 1)}>Retry verification</Button>}
  </section>;
}
