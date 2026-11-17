import { control } from "./control-store";
import { deploymentTimeZone } from "./installation-timezone";
import { Form } from "./action-form";
import { Field } from "./field";
import { PanelCard } from "@/components/layout/panel-card";
import { Button } from "@/components/ui/button";

export function InstallationMailTimezonePanel() {
  const store = control(), mail = store.mailPublic(), timezone = store.timezone();
  return <>
    <PanelCard><details open={Boolean(mail)}>
      <summary className="text-xl font-semibold">Installation Exchange email transport</summary>
      <p className="my-3">Microsoft Graph transport is shared across databases. Notification enablement, recipients, reminders and history belong to each workspace. Saving here sends no email and does not enable the reminder worker.</p>
      {mail ? <Form key={mail.version} op="mail-save" version={mail.version}>
        <Field name="tenantId" label="Tenant ID" value={mail.tenantId} required={false} />
        <Field name="clientId" label="Application / client ID" value={mail.clientId} required={false} />
        <Field name="senderMailbox" label="Sender mailbox" value={mail.senderMailbox} required={false} type="email" maxLength={240} />
        <Field name="clientSecret" label="Replace client secret" type="password" required={false} maxLength={4096} help={mail.credentialConfigured ? "A secret is encrypted and configured. Leave blank to preserve it." : "No credential configured. Mail requires tenant, client, secret and sender."} />
        <Field name="clearSecret" label="Type CLEAR only to remove the stored runtime credential" required={false} help="Do not enter a replacement secret when clearing. Existing encrypted rollback snapshots remain protected." />
        <Button type="submit">Save installation mail transport</Button>
      </Form> : <>
        <p className="my-3">Stage or capture and review existing transport settings first. Older snapshots require the original mail encryption key. New installations can enable an empty transport and configure it here.</p>
        <Form op="mail-enable" version={store.presentationCandidateVersion()}><Field name="confirmation" label="Type ENABLE to use persistent installation mail transport" /><Button type="submit">Enable installation mail transport</Button></Form>
      </>}
    </details></PanelCard>
    <PanelCard><details open={Boolean(timezone)}>
      <summary className="text-xl font-semibold">Installation timezone</summary>
      <p className="my-3">Calendar dates use this timezone; existing UTC timestamps are not rewritten. Changing it can change which loans are due today. The reminder worker remains disabled in managed mode.</p>
      {timezone ? <Form key={timezone.version} op="timezone-save" version={timezone.version}>
        <Field name="timeZone" label="IANA timezone" value={timezone.timeZone} maxLength={120} help="For example America/Toronto or UTC." />
        <Button type="submit">Save installation timezone</Button>
      </Form> : <>
        <p className="my-3">Timezone to enable: {store.installationConfiguration()?.timeZone ?? deploymentTimeZone()}. A snapshot without a timezone uses the current deployment timezone at enablement.</p>
        <Form op="timezone-enable" version={store.presentationCandidateVersion()}><Field name="confirmation" label="Type ENABLE to persist the installation timezone" /><Button type="submit">Enable installation timezone</Button></Form>
      </>}
    </details></PanelCard>
  </>;
}
