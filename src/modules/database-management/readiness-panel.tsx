"use client";
import { useReadiness } from "./use-readiness";
import { Button } from "@/components/ui/button";
import { Form } from "./action-form";
export function ReadinessPanel({
  active, organization, profile,
}: {
  active: boolean;
  organization: string;
  profile: string;
}) {
  const { result, finished, retry } = useReadiness(active);
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
    ) : finished && <Button type="button" onClick={retry}>Retry verification</Button>}
  </section>;
}
