"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { activationVerified, type ReadinessResult } from "./setup-state";

export function useReadiness(active: boolean, targetProfile?: string, targetRevision?: number) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<ReadinessResult>({ ready: false, message: "Checking application readiness…" });
  useEffect(() => {
    if (!active) return;
    let stopped = false, count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setFinished(false);
    setResult({ ready: false, message: "Checking application readiness…" });
    const check = async () => {
      count++;
      let ready = false, changed = false;
      const deadline = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/setup/status", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          window.location.replace(targetProfile ? "/settings/database-management" : "/setup");
          return;
        }
        if (!response.ok) throw new Error();
        let data: ReadinessResult = await response.json();
        if (targetProfile && data.revision !== undefined) {
          changed = data.profile !== targetProfile || data.revision !== targetRevision;
          if (changed) data = { ready: false, message: "The database selection changed. Review the active database before continuing." };
        }
        ready = targetProfile && targetRevision !== undefined
          ? activationVerified(data, targetProfile, targetRevision)
          : data.ready === true;
        if (!stopped) {
          setResult(data);
          if (ready) router.refresh();
        }
      } catch {
        if (!stopped) setResult({ ready: false, message: "Readiness could not be confirmed. Wait for restart, then retry verification." });
      } finally {
        clearTimeout(deadline);
      }
      if (stopped) return;
      if (ready || changed || count >= 6 || controller.signal.aborted) setFinished(true);
      else timer = setTimeout(() => void check(), 5000);
    };
    void check();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [active, attempt, router, targetProfile, targetRevision]);
  return { result, finished, retry: () => setAttempt(x => x + 1) };
}
