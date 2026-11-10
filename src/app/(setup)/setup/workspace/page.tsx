import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SetupWizardShell } from "@/components/layout/setup-wizard-shell";
import {
  control,
  controlCookie,
  managed,
  visitFingerprint,
} from "@/modules/database-management/control-store";
import { wizardSteps } from "@/modules/database-management/setup-steps";
import { OrganizationForm } from "@/modules/database-management/organization-form";
import { DatabasePanel } from "@/modules/database-management/panel";
import { ManagementVisitGuard } from "@/modules/database-management/visit-guard";
import { ReadinessPanel } from "@/modules/database-management/readiness-panel";
import { schemaFingerprint } from "@/modules/database-management/setup-service";
import { wizardProgress } from "@/modules/database-management/wizard-progress";
import { isReady } from "@/modules/database-management/setup-state";
import { WizardFooter } from "@/modules/database-management/wizard-footer";
import { Form } from "@/modules/database-management/action-form";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export default async function SetupWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; message?: string }>;
}) {
  if (!managed()) notFound();
  const store = control();
  const token = (await cookies()).get(controlCookie)?.value ?? "";
  if (!store.authorized(token)) redirect("/setup");
  const { step: requested, message } = await searchParams;
  const organization = store.organization();
  const profiles = store.profiles();
  const selection = store.state();
  const inspections = Object.fromEntries(
    profiles.map((p) => {
      const evidence = store.inspection(p.id);
      return [
        p.id,
        evidence?.version === p.version && evidence.fingerprint === schemaFingerprint(p.provider)
          ? evidence
          : null,
      ];
    }),
  );
  const candidate = profiles.find((p) => p.id === store.candidate())
    ?? profiles.find((p) => p.id === selection.active);
  const evidence = candidate ? inspections[candidate.id] : null;
  const ready = Boolean(candidate && isReady(
    store.readiness(), store.runtime(), selection,
    candidate.version, schemaFingerprint(candidate.provider),
  ));
  const progress = wizardProgress(
    Boolean(organization), store.registered(), evidence,
    Boolean(candidate && candidate.id === selection.active), ready,
  );
  const step = Number(requested && /^[1-5]$/.test(requested) ? requested : store.resumeStep());
  if (step > progress.maximum) redirect("/setup/workspace?step=" + progress.maximum);
  return (
    <SetupWizardShell
      steps={wizardSteps}
      currentStep={step}
      completedSteps={progress.completed}
      title={organization ? organization.siteName + " · First-run setup" : undefined}
      description="Set up your organization, connect a database, and open your workspace."
      footer={
        <div className="ml-auto">
          <Form op="logout"><Button variant="ghost" type="submit">Sign out of setup</Button></Form>
        </div>
      }
    >
      <ManagementVisitGuard fingerprint={visitFingerprint(token)} />
      {message && <p role="status" className="mb-4 text-sm">{message}</p>}
      <div className="min-w-0 space-y-5">
        {step === 1 && <OrganizationForm organization={organization} />}
        {step === 2 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">✓ Installation administrator created.</h2>
            <p className="break-words">{store.administratorEmail()}</p>
            <p className="text-sm">This account manages your installation. Workspace accounts remain separate.</p>
          </section>
        )}
        {(step === 3 || step === 4) && (
          <>
            <h2 className="text-2xl font-semibold">{step === 3 ? "Database Connection" : "Workspace Preparation"}</h2>
            <DatabasePanel
              {...selection}
              selected={candidate?.id}
              profiles={step === 4 ? candidate ? [candidate] : [] : profiles}
              inspections={inspections}
              activity={[]}
              stage={step === 3 ? "connections" : "prepare"}
            />
          </>
        )}
        {step === 5 && (
          <ReadinessPanel
            active={Boolean(selection.active)}
            organization={organization?.siteName ?? ""}
            profile={candidate ? candidate.name + " · " + candidate.database : ""}
          />
        )}
      </div>
      <WizardFooter step={step} maximum={progress.maximum} />
    </SetupWizardShell>
  );
}
