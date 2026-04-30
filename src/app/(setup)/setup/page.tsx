import { requireBootstrapPage } from "@/lib/bootstrap.server";

import SetupWizardPage from "./setup-wizard-page";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  await requireBootstrapPage();

  return <SetupWizardPage />;
}
