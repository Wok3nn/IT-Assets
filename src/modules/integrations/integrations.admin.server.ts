import "server-only";
import { getCurrentUser } from "@/lib/session.server";
import { getCurrentUserPermissionContext } from "@/lib/permissions.server";
import { canManageIntegrations } from "./integrations.shared";

export async function getIntegrationAdministrator() {
  const user = await getCurrentUser();
  if (!user) return null;
  const context = await getCurrentUserPermissionContext();
  return canManageIntegrations({ isActive: user.isActive, ...context }) ? user : null;
}
