import { z } from "zod";

export const INTEGRATIONS = [{
  id: "deskmap",
  name: "DeskMap",
  description: "Show approved users’ assigned assets when their desk card is selected.",
}] as const;
export const ASSIGNMENT_SCOPE = "assigned-assets:read";
export const integrationIdSchema = z.enum(["deskmap"]);
export type IntegrationId = z.infer<typeof integrationIdSchema>;
export const guidSchema = z.string().trim().uuid().transform((value) => value.toLowerCase());
export const identitySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("entra"), tenantId: guidSchema, id: guidSchema }),
  z.object({ type: z.literal("local"), id: z.string().cuid() }),
]);
export type IntegrationIdentity = z.infer<typeof identitySchema>;
export type IntegrationOverview = {
  id: IntegrationId;
  name: string;
  description: string;
  enabled: boolean;
  credentialConfigured: boolean;
  expiresAt: string | null;
  lastSuccessAt: string | null;
  status: string;
  grants: Array<{ key: string; userId: string; identity: string }>;
  activity: Array<{ id: string; summary: string; createdAt: string }>;
};

export function canManageIntegrations(input: {
  isActive: boolean;
  roleKeys: string[];
  capabilities: { viewSettings: boolean; managePermissions: boolean };
}) {
  return input.isActive && input.roleKeys.includes("SUPER_ADMIN") &&
    input.capabilities.viewSettings && input.capabilities.managePermissions;
}
