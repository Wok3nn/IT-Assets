import { control } from "./control-store";
import { Form } from "./action-form";
import { Field } from "./field";
import { SettingsSection, SettingsApproval } from "./settings-section";
import { Button } from "@/components/ui/button";

export function InstallationEntraPanel() {
  const store = control(), values = store.entraPublic();
  return <SettingsSection title="Microsoft Entra sign-in" status={values ? "Enabled" : "Not enabled"}
    description="Manage the Microsoft account connection used by this installation."
    help={<><p>Credentials are encrypted and shared across databases. Each workspace keeps its sign-in policy, users and role mappings; enabling this does not grant anyone access.</p><p>Import and review existing provider settings before enabling. A blank callback uses the public app URL; an explicit URL must match the Entra registration, including any public port.</p><p>Leave the secret blank to keep the encrypted credential. Its value is never displayed.</p></>}>
    {values ? <Form key={values.version} op="entra-save" version={values.version}>
      <Field name="tenantId" label="Tenant ID" value={values.tenantId} maxLength={160} />
      <Field name="clientId" label="Application / client ID" value={values.clientId} maxLength={160} />
      <Field name="redirectUri" label="Public callback URL" value={values.redirectUri} required={false} maxLength={300} />
      <Field name="clientSecret" label="Replace client secret" type="password" required={false} maxLength={16384} help="Leave blank to keep the current secret." />
      <Button type="submit">Save Entra sign-in</Button>
    </Form> : <>
      <p className="text-sm">Import and review your Entra settings before enabling.</p>
      <Form op="entra-enable" version={store.presentationCandidateVersion()}>
        <SettingsApproval>Use the reviewed Entra credentials across databases.</SettingsApproval>
        <Button type="submit">Enable Entra sign-in</Button>
      </Form>
    </>}
  </SettingsSection>;
}
