import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/page-hero";
import { InstallationShell } from "@/components/layout/installation-shell";
import { control, managed } from "@/modules/database-management/control-store";
import { ControlLogin } from "@/modules/database-management/panel";
import { ManagementNavigation } from "@/modules/database-management/navigation";
export const dynamic = "force-dynamic";
export default async function DatabaseManagement({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!managed()) notFound();
  const store = control(),
    active = Boolean(store.state().active);
  const { message } = await searchParams;
  return (
    <InstallationShell
      context="Installation administrator sign-in"
      navigation={<ManagementNavigation active={active} />}
    >
      <PageHero>
        <h1 className="text-3xl font-semibold">
          {store.registered() ? "Database Management" : "Welcome to IT Assets"}
        </h1>
        <p className="mt-2">
          {store.registered()
            ? "Sign in for this management visit. Your workspace session stays separate."
            : "First, secure your installation with a local administrator. No external database is required."}
        </p>
      </PageHero>
      {message && <p role="status">{message}</p>}
      <ControlLogin registered={store.registered()} />
    </InstallationShell>
  );
}
