"use client";
import { Button } from "@/components/ui/button";
import { PanelCard } from "@/components/layout/panel-card";
import { activationVerified } from "./setup-state";
import { useReadiness } from "./use-readiness";

export function ActivationStatus({ profile, revision }: { profile: string; revision: number }) {
  const { result, finished, retry } = useReadiness(true, profile, revision);
  const verified = activationVerified(result, profile, revision);
  return <PanelCard>
    <div aria-live="polite" className="space-y-3">
      <h2 className="text-lg font-semibold">{verified ? "Database activated — application ready." : "Verifying database activation"}</h2>
      <p role={!verified && finished ? "alert" : "status"} className={verified ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm"}>
        {verified ? "The selected database is compatible and the application has reconnected. Sign in to the workspace to continue." : result.message}
      </p>
      {!verified && finished && <Button type="button" variant="secondary" onClick={retry}>Retry verification</Button>}
    </div>
  </PanelCard>;
}
