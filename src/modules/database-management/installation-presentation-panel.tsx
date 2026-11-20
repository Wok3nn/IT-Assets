import { control } from "./control-store";
import { Form } from "./action-form";
import { Field } from "./field";
import { SettingsSection, SettingsApproval } from "./settings-section";
import { Button } from "@/components/ui/button";
import { presentationValues } from "./installation-presentation";
export function InstallationPresentationPanel() {
  const store = control(), presentation = store.presentation();
  const staged = !presentation ? store.installationConfiguration() : null;
  let preview: ReturnType<typeof presentationValues> | null = null;
  try { if (staged) preview = presentationValues(staged); } catch { /* Activation reports the validation error without disclosing raw settings. */ }
  return <SettingsSection title="Appearance & session" status={presentation ? "Enabled" : "Not enabled"}
    description="Choose the app name, images and session length."
    help={<><p>These settings apply across databases, including when inventory is offline. Users, roles and sign-in permissions stay with each workspace.</p><p>Importing existing settings replaces shared values only after approval. Existing installations need a verified settings import; new installations can start with organization defaults.</p><p>Upload PNG logos or PNG/ICO icons up to 2 MB. Leave a file empty to keep its current image.</p></>}>
    {presentation ? <Form key={presentation.version} op="presentation-save" version={presentation.version}>
      <Field name="appTitle" label="Application title" value={presentation.appTitle} maxLength={80} />
      <Field name="sessionTimeoutMinutes" label="Session length (minutes)" type="number" min={5} max={60} value={String(presentation.sessionTimeoutMinutes)} />
      {(["logo.light", "logo.dark", "icon.light", "icon.dark"] as const).map(kind => <Field key={kind} name={"branding." + kind} label={"Replace " + kind.replace(".", " ")} type="file" required={false} accept={kind.startsWith("logo") ? "image/png" : "image/png,image/x-icon,image/vnd.microsoft.icon"} />)}
      <Button type="submit">Save appearance & session</Button>
    </Form> : <>

      {preview && <p className="my-3">Ready to use: <strong>{preview.appTitle}</strong>. Session timeout: {preview.sessionTimeoutMinutes} minutes. {staged!.branding.length} preserved branding file(s).</p>}
      <Form op="presentation-enable" version={store.presentationCandidateVersion()}>
        <SettingsApproval>Use these appearance and session settings across databases.</SettingsApproval>
        <Button type="submit">Enable appearance & session</Button>
      </Form>
    </>}
  </SettingsSection>;
}
