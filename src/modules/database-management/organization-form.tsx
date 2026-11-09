import { Button } from "@/components/ui/button";
import { Field } from "./panel";
import { Form } from "./action-form";
import type { Organization } from "./setup-state";
export function OrganizationForm({
  organization,
}: {
  organization: (Organization & { version: string }) | null;
}) {
  return (
    <Form op="organization" step="1">
      <h2 className="text-xl font-semibold">
        Organization & local installation settings
      </h2>
      <input
        type="hidden"
        name="organizationVersion"
        value={organization?.version ?? ""}
      />
      <Field
        name="siteName"
        label="Organization / site name"
        value={organization?.siteName}
      />
      <Field
        name="appTitle"
        label="Application name"
        value={organization?.appTitle ?? "IT Assets"}
      />
      <p className="text-sm">
        Saved locally. Existing workspace branding is never overwritten. Default
        logos and the theme preview are available during setup.
      </p>
      <Button type="submit">Save installation settings</Button>
    </Form>
  );
}
