import { notFound } from "next/navigation";
import { InstallationShell } from "@/components/layout/installation-shell";
import { control, managed } from "@/modules/database-management/control-store";
import { ManagementNavigation } from "@/modules/database-management/navigation";
import { SetupOverview } from "@/modules/database-management/setup-overview";
export const dynamic = "force-dynamic";
export default function InstallationPage() {
  if (!managed()) notFound();
  const store = control(),
    active = Boolean(store.state().active);
  return (
    <InstallationShell
      context={
        active ? "Asset workspace selected" : "No asset database connected"
      }
      navigation={<ManagementNavigation active={active} />}
    >
      <SetupOverview registered={store.registered()} active={active} />
    </InstallationShell>
  );
}
