import type { Inspection } from "./setup-state";
export function wizardProgress(organization: boolean, registered: boolean, inspected: Inspection | null, active: boolean, ready = false) {
  const usable = inspected?.status === "empty" || inspected?.status === "compatible";
  const prepared = inspected?.status === "compatible" && active;
  return {
    maximum: !organization ? 1 : !registered ? 2 : !usable ? 3 : !prepared ? 4 : 5,
    completed: [organization ? 1 : 0, registered ? 2 : 0, usable ? 3 : 0, prepared ? 4 : 0, organization && registered && prepared && ready ? 5 : 0].filter(Boolean),
  };
}
