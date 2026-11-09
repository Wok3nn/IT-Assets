import { redirect } from "next/navigation";
import { PageHero } from "@/components/layout/page-hero";
import { isBootstrapComplete } from "@/services/bootstrap-config";

export const dynamic = "force-dynamic";

export default async function DatabaseSetupPage() {
  if (process.env.IT_ASSETS_MANAGED === "1") redirect("/setup");
  if (await isBootstrapComplete()) redirect("/setup");
  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHero>
        <h1 className="text-2xl font-semibold">Database setup has moved</h1>
        <p>
          Start the installation in managed mode, then sign in to Settings →
          Database Management to configure SQL Server.
        </p>
      </PageHero>
    </main>
  );
}
