import { requireBootstrapPage } from "@/lib/bootstrap.server";

import SetupWizardPage from "./setup-wizard-page";
import { control, managed } from "@/modules/database-management/control-store";
import { SetupEntry } from "@/modules/database-management/setup-entry";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (managed())
    return (
      <SetupEntry
        registered={control().registered()}
        message={(await searchParams).message}
      />
    );
  await requireBootstrapPage();

  return <SetupWizardPage />;
}
