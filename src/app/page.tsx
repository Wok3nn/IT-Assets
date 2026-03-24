import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { readSetupState } from "@/services/setup-state";

export default async function HomePage() {
  const [setupState, currentUser] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (currentUser) {
    redirect("/dashboard");
  }

  redirect("/login");
}

