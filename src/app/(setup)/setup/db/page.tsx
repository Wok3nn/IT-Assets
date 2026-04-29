import { redirect } from "next/navigation";
import { isBootstrapComplete } from "@/services/bootstrap-config";

import DatabaseSetupClientPage from "./setup-db-client-page";

export const dynamic = "force-dynamic";

export default async function DatabaseSetupPage() {
  if (await isBootstrapComplete()) {
    redirect("/setup");
  }

  return <DatabaseSetupClientPage />;
}
