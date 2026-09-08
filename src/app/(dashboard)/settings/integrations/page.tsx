import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { PageHero } from "@/components/layout/page-hero";
import { getIntegrationAdministrator } from "@/modules/integrations/integrations.admin.server";
import { configureIntegration, listIntegrationOverviews } from "@/modules/integrations/integrations.service";
import { IntegrationsPanel, type IntegrationActionResult } from "@/modules/integrations/components/integrations-panel";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

async function configureIntegrationAction(_state: IntegrationActionResult, data: FormData): Promise<IntegrationActionResult> {
  "use server";
  const actor = await getIntegrationAdministrator();
  if (!actor) return { error: "You do not have permission to manage integrations." };
  if (!(await readSetupState())?.isCompleted) return { error: "Complete application setup first." };
  const identity = data.get("identityType") === "local"
    ? { type: "local", id: data.get("userId") }
    : { type: "entra", id: data.get("objectId"), tenantId: data.get("tenantId") };
  try {
    const token = await configureIntegration({
      id: data.get("integrationId"), operation: data.get("operation"), actorUserId: actor.id,
      identity, userId: data.get("userId"), grantKey: data.get("grantKey"),
    });
    revalidatePath("/settings/integrations");
    return { message: "Integration updated.", ...(token ? { token } : {}) };
  } catch (error) {
    if (error instanceof ZodError) return { error: "Check the integration and identity fields." };
    // Only known policy messages may reach the browser; database errors stay private.
    const allowed = ["Create a credential and approve at least one user before enabling this integration.", "Local identity must match the approved user ID.", "Choose an active application user."];
    return { error: error instanceof Error && allowed.includes(error.message) ? error.message : "Unable to update the integration. Try again." };
  }
}

export default async function IntegrationsPage() {
  if (!(await getIntegrationAdministrator())) redirect("/settings");
  if (!(await readSetupState())?.isCompleted) redirect("/setup");
  const integrations = await listIntegrationOverviews();
  return <div className="space-y-6">
    <PageHero>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Integrations</h1><p className="mt-3">Manage approved read-only connections to other applications.</p></div>
        <Link href="/settings" className="text-sm underline underline-offset-4">Back to settings</Link>
      </div>
    </PageHero>
    <IntegrationsPanel integrations={integrations} action={configureIntegrationAction} />
  </div>;
}
