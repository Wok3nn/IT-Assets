import { control } from "./control-store";
import { deploymentTimeZone } from "./installation-timezone";
import { Form } from "./action-form";
import { Field } from "./field";
import { SettingsSection, SettingsApproval, SettingsHelp } from "./settings-section";
import { Button } from "@/components/ui/button";

export function InstallationMailTimezonePanel() {
  const store = control(), mail = store.mailPublic(), timezone = store.timezone();
  return <>
    <SettingsSection title="Email settings" status={mail ? "Enabled" : "Not enabled"}
      description="Choose the Microsoft account and mailbox used to send email."
      help={<><p>Microsoft Graph credentials are encrypted and shared across databases. Notification choices, recipients and history stay with each workspace.</p><p>Saving sends no email and does not enable scheduled reminders. Import existing settings before enabling; older imports need the original encryption key. New installations can start with empty settings.</p></>}>
      {mail ? <Form key={mail.version} op="mail-save" version={mail.version}>
        <Field name="tenantId" label="Tenant ID" value={mail.tenantId} required={false} />
        <Field name="clientId" label="Application / client ID" value={mail.clientId} required={false} />
        <Field name="senderMailbox" label="Sender mailbox" value={mail.senderMailbox} required={false} type="email" maxLength={240} />
        <Field name="clientSecret" label="Replace client secret" type="password" required={false} maxLength={4096} help={mail.credentialConfigured ? "Leave blank to keep the current secret." : "No secret configured."} />
        <SettingsHelp label="Remove the saved email secret">
          <Field name="clearSecret" label="Type CLEAR to remove the secret" required={false} help="Leave the replacement secret empty. Encrypted rollback copies are retained." />
        </SettingsHelp>
        <Button type="submit">Save email settings</Button>
      </Form> : <Form op="mail-enable" version={store.presentationCandidateVersion()}>
        <SettingsApproval>Use these email settings across databases.</SettingsApproval>
        <Button type="submit">Enable email settings</Button>
      </Form>}
    </SettingsSection>
    <SettingsSection title="Timezone" status={timezone ? "Enabled" : "Not enabled"}
      description="Set the timezone used for calendar dates."
      help={<><p>This setting applies across databases and can change which loans are due today. Existing timestamps are not rewritten; scheduled reminders remain disabled.</p><p>An import without a timezone uses the deployment timezone when enabled.</p></>}>
      {timezone ? <Form key={timezone.version} op="timezone-save" version={timezone.version}>
        <Field name="timeZone" label="Timezone" value={timezone.timeZone} maxLength={120} help="For example America/Toronto or UTC." />
        <Button type="submit">Save timezone</Button>
      </Form> : <>
        <p className="text-sm">Ready to use: {store.installationConfiguration()?.timeZone ?? deploymentTimeZone()}</p>
        <Form op="timezone-enable" version={store.presentationCandidateVersion()}>
          <SettingsApproval>Use this timezone across databases.</SettingsApproval>
          <Button type="submit">Enable timezone</Button>
        </Form>
      </>}
    </SettingsSection>
  </>;
}
