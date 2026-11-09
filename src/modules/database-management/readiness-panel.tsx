"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Form } from "./action-form";
export function ReadinessPanel({
  active,
  organization,
  profile,
}: {
  active: boolean;
  organization: string;
  profile: string;
}) {
  const [result, setResult] = useState<{
    ready: boolean;
    verified?: boolean;
    message: string;
  }>({
    ready: false,
    message: active
      ? "Checking the selected application…"
      : "Activate a compatible connection to continue.",
  });
  useEffect(() => {
    if (!active) return;
    let stopped = false,
      busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch("/setup/status", { cache: "no-store" });
        if (response.status === 401) {
          window.location.replace("/setup");
          return;
        }
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!stopped) setResult(data);
      } catch {
        if (!stopped)
          setResult({
            ready: false,
            message:
              "Waiting for the application to restart. Recovery and restart guidance remain available below.",
          });
      } finally {
        busy = false;
      }
    };
    void check();
    const timer = setInterval(() => void check(), 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active]);
  return (
    <section className="space-y-4" aria-live="polite">
      <h2 className="text-2xl font-semibold">
        {result.ready
          ? "Congratulations! IT Assets is ready."
          : "Review & Complete"}
      </h2>
      <p>
        {organization || "Organization not configured"} ·{" "}
        {profile || "No active connection"}
      </p>
      <p>{result.message}</p>
      <ul aria-label="Live readiness checklist" className="space-y-2">
        {[
          "Connectivity verified",
          "Database schema compatible",
          "Workspace initialized or existing compatible workspace detected",
          "Database activated and serving requests",
          "Application ready",
        ].map((label, i) => {
          const done = i === 4 ? result.ready : Boolean(result.verified);
          return (
            <li
              key={label}
              className={
                done
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-slate-500"
              }
            >
              {done ? "✓" : "○"} {label}
            </li>
          );
        })}
      </ul>
      {result.ready && (
        <>
          <p className="text-emerald-700 dark:text-emerald-300">
            ✓ Connection verified · Schema compatible · Workspace ready ·
            Database activated · Application ready
          </p>
          <Form op="exit">
            <input type="hidden" name="destination" value="inventory" />
            <Button type="submit">Go to IT Assets</Button>
          </Form>
        </>
      )}
      <Link
        href="/settings/database-management/workspace"
        prefetch={false}
        className="underline"
      >
        Manage Database Connections
      </Link>
      <details>
        <summary>Restart and recovery guidance</summary>
        <p className="mt-2">
          Managed activation restarts the application automatically. If the
          supervisor is stopped, use your existing control directory:
        </p>
        <ul className="list-disc pl-5 text-sm">
          <li>
            Local development: <code>npm run dev</code>
          </li>
          <li>
            Managed Node production: <code>npm run start:managed</code> (after
            building)
          </li>
          <li>
            Docker Compose:{" "}
            <code>
              docker compose -f docker/compose.managed.yml restart web
            </code>
          </li>
          <li>
            No Windows service installer is provided. If you configured your own
            service, restart that service through its administrator.
          </li>
        </ul>
        <p className="mt-2">
          Never reinitialize an existing or partial database. Inspect it first;
          local management sign-in remains available during database outages.
        </p>
      </details>
    </section>
  );
}
