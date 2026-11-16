import { control } from "./control-store";
import { Form } from "./action-form";
import { Field } from "./field";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";
import { presentationValues } from "./installation-presentation";
export function InstallationPresentationPanel() {
  const store = control(), presentation = store.presentation();
  const staged = !presentation ? store.installationConfiguration() : null;
  let preview: ReturnType<typeof presentationValues> | null = null;
  try { if (staged) preview = presentationValues(staged); } catch { /* Activation reports the validation error without disclosing raw settings. */ }
  return <PanelCard><details open={Boolean(presentation)}>
    <summary className="text-xl font-semibold">Installation appearance and session policy</summary>
    <p className="my-3">These settings apply across inventory databases and remain available when inventory is offline. Workspace roles, users and sign-in grants remain separate.</p>
    {presentation ? <Form key={presentation.version} op="presentation-save" version={presentation.version}>
      <Field name="appTitle" label="Application title" value={presentation.appTitle} maxLength={80} />
      <Field name="sessionTimeoutMinutes" label="Workspace session timeout (minutes)" type="number" min={5} max={60} value={String(presentation.sessionTimeoutMinutes)} />
      {(["logo.light", "logo.dark", "icon.light", "icon.dark"] as const).map(kind => <Field key={kind} name={"branding." + kind} label={"Replace " + kind.replace(".", " ")} type="file" required={false} accept={kind.startsWith("logo") ? "image/png" : "image/png,image/x-icon,image/vnd.microsoft.icon"} help="Optional PNG logo or PNG/ICO icon, at most 2 MB. Leaving empty preserves the current image." />)}
      <Button type="submit">Save installation settings</Button>
    </Form> : <>
      <p className="my-3">Shared presentation settings are not enabled. Existing installations must first stage their verified legacy configuration offline. New installations with no saved connections can enable defaults from their organization settings.</p>
      {preview && <p className="my-3">Staged title: <strong>{preview.appTitle}</strong>. Session timeout: {preview.sessionTimeoutMinutes} minutes. {staged!.branding.length} preserved branding file(s).</p>}
      <Form op="presentation-enable" version={store.presentationCandidateVersion()}>
        <Field name="confirmation" label="Type ENABLE to use persistent installation appearance and session settings" />
        <Button type="submit">Enable installation-wide presentation</Button>
      </Form>
    </>}
  </details></PanelCard>;
}
