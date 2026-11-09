import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
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
import { ControlExit } from "@/modules/database-management/control-shell";
import { ManagementVisitGuard } from "@/modules/database-management/visit-guard";
import { ReadinessPanel } from "@/modules/database-management/readiness-panel";
import { schemaFingerprint } from "@/modules/database-management/setup-service";
export const dynamic = "force-dynamic";
export default async function SetupWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; message?: string }>;
}) {
  if (!managed()) notFound();
  const store = control(),
    token = (await cookies()).get(controlCookie)?.value ?? "";
  if (!store.authorized(token)) redirect("/setup");
  const { step: requested, message } = await searchParams;
  const organization = store.organization(),
    profiles = store.profiles(),
    selection = store.state();
  const step = ["1", "2", "3", "4", "5"].includes(requested ?? "")
    ? requested!
    : store.resumeStep();
  const inspections = Object.fromEntries(
    profiles.map((p) => {
      const evidence = store.inspection(p.id);
      return [
        p.id,
        evidence?.fingerprint === schemaFingerprint(p.provider)
          ? evidence
          : null,
      ];
    }),
  );
  const selected = profiles.find((p) => p.id === selection.active);
  const candidate = profiles.find(
    (p) => p.id === (selection.active ?? store.candidate()),
  );
  return (
    <SetupWizardShell
      steps={wizardSteps}
      title={
        organization ? `${organization.siteName} · First-run setup` : undefined
      }
      description="Complete your installation securely. Workspace accounts remain separate from this installation account."
    >
      <ManagementVisitGuard fingerprint={visitFingerprint(token)} />
      <nav aria-label="Setup steps" className="mb-5 flex flex-wrap gap-3">
        {wizardSteps.map((s, i) => (
          <Link
            key={s.title}
            href={`/setup/workspace?step=${i + 1}`}
            prefetch={false}
            aria-current={step === String(i + 1) ? "step" : undefined}
            className={
              step === String(i + 1) ? "font-bold underline" : "underline"
            }
          >
            {s.title}
          </Link>
        ))}
      </nav>
      {message && (
        <p role="status" className="mb-4">
          {message}
        </p>
      )}
      <div className="space-y-5">
        {step === "1" && <OrganizationForm organization={organization} />}
        {step === "2" && (
          <section>
            <h2 className="text-xl font-semibold">
              ✓ Installation administrator registered
            </h2>
            <p>
              Enrollment is permanently closed. Your account manages connections
              and local settings, not workspace permissions.
            </p>
            <Link
              href="/setup/workspace?step=3"
              prefetch={false}
              className="underline"
            >
              Continue to database connection
            </Link>
          </section>
        )}
        {["3", "4"].includes(step) && (
          <DatabasePanel
            {...selection}
            profiles={profiles}
            inspections={inspections}
            activity={[]}
            stage={step === "3" ? "connections" : "prepare"}
          />
        )}
        {step === "5" && (
          <>
            <ul className="space-y-2" aria-label="Setup checklist">
              {[
                [Boolean(organization), "Organization configured"],
                [store.registered(), "Installation administrator registered"],
                [Boolean(candidate), "Database connection saved"],
                [
                  Boolean(selected),
                  "Database selected — live activation verified below",
                ],
              ].map(([done, label]) => (
                <li
                  key={String(label)}
                  className={
                    done
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-slate-500"
                  }
                >
                  {done ? "✓" : "○"} {label}
                </li>
              ))}
            </ul>
            <DatabasePanel
              {...selection}
              profiles={profiles}
              inspections={inspections}
              activity={[]}
              stage="activate"
            />
            <ReadinessPanel
              active={Boolean(selected)}
              organization={organization?.siteName ?? ""}
              profile={
                selected
                  ? `${selected.name} · ${selected.provider} · ${selected.database}`
                  : ""
              }
            />
          </>
        )}
        {step === "3" && (
          <Link
            href="/setup/workspace?step=4"
            prefetch={false}
            className="block underline"
          >
            Continue to workspace preparation
          </Link>
        )}
        {step === "4" && (
          <Link
            href="/setup/workspace?step=5"
            prefetch={false}
            className="block underline"
          >
            Review & activate database
          </Link>
        )}
        <ControlExit active={Boolean(selection.active)} />
      </div>
    </SetupWizardShell>
  );
}
