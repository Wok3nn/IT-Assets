import { requireBootstrapPage } from "@/lib/bootstrap.server";

import SetupWizardPage from "./setup-wizard-page";

export default async function SetupPage() {
  await requireBootstrapPage();

  return <SetupWizardPage />;
}
