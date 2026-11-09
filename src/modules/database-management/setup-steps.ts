import { Building2, ShieldUser, Database, Check, Rocket } from "lucide-react";
export const wizardSteps = [
  {
    title: "1. Welcome & Organization",
    description: "Name your installation. Start without an external database.",
    icon: Building2,
  },
  {
    title: "2. Installation Administrator",
    description:
      "Secure local setup access; this is separate from your workspace identity.",
    icon: ShieldUser,
  },
  {
    title: "3. Database Connection",
    description: "Connect SQL Server or MariaDB and inspect its schema safely.",
    icon: Database,
  },
  {
    title: "4. Workspace Preparation",
    description:
      "Initialize an empty database or reuse a compatible workspace.",
    icon: Check,
  },
  {
    title: "5. Review & Complete",
    description: "Activate, verify readiness and open IT Assets.",
    icon: Rocket,
  },
];
