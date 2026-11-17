import { control } from "./control-store";
import { Form } from "./action-form";
import { Field } from "./field";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

export function InstallationEntraPanel() {
  const store = control(), values = store.entraPublic();
  return <PanelCard><details open={Boolean(values)}>
    <summary className="text-xl font-semibold">Microsoft Entra installation credentials</summary>
    <p className="my-3">Provider credentials persist across database changes. Each workspace retains its own sign-in policy, users and group-to-role mappings. An Entra identity must have an enabled account in the active workspace.</p>
    {values ? <Form key={values.version} op="entra-save" version={values.version}>
      <Field name="tenantId" label="Tenant ID" value={values.tenantId} maxLength={160} />
      <Field name="clientId" label="Application / client ID" value={values.clientId} maxLength={160} />
      <Field name="redirectUri" label="Public callback URL" value={values.redirectUri} required={false} maxLength={300} help="Leave empty to use the public APP_URL callback. Use the URL registered in Entra, including any public port." />
      <Field name="clientSecret" label="Replace client secret" type="password" required={false} maxLength={16384} help="A credential is configured and encrypted. Leave empty to preserve it. Its contents are never displayed." />
      <Button type="submit">Save installation Entra credentials</Button>
    </Form> : <>
      <p className="my-3">Capture and review the existing provider configuration offline first. Enabling copies its verified credential into encrypted installation storage; it does not grant workspace access.</p>
      <Form op="entra-enable" version={store.presentationCandidateVersion()}>
        <Field name="confirmation" label="Type ENABLE to use the staged installation Entra credentials" />
        <Button type="submit">Enable installation Entra credentials</Button>
      </Form>
    </>}
  </details></PanelCard>;
}
