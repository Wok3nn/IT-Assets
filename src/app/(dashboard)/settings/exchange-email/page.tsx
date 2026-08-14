import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { getCurrentUserSettingsPermissionContext } from "@/lib/permissions.server";
import { getCurrentUser } from "@/lib/session.server";
import { sendExchangeTestEmail } from "@/modules/borrowed-items/borrowed-item-notifications.service";
import { ExchangeEmailSettingsPanel, type ExchangeTestEmailState } from "@/modules/settings/components/exchange-email-settings-panel";
import {
  clearExchangeEmailClientSecret,
  getExchangeEmailSettings,
  updateExchangeEmailSettings,
} from "@/modules/settings/exchange-email-settings.service";
import { readSetupState } from "@/services/setup-state";

export const dynamic = "force-dynamic";

function getBooleanFormValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

async function saveExchangeEmailSettingsAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserSettingsPermissionContext();

  if (!permissionContext.canViewSettings) {
    redirect("/dashboard");
  }

  try {
    await updateExchangeEmailSettings({
      mailEnabled: getBooleanFormValue(formData, "mailEnabled"),
      tenantId: String(formData.get("tenantId") ?? "").trim(),
      clientId: String(formData.get("clientId") ?? "").trim(),
      clientSecret: String(formData.get("clientSecret") ?? ""),
      senderMailbox: String(formData.get("senderMailbox") ?? "").trim(),
      adminRecipient: String(formData.get("adminRecipient") ?? "").trim(),
      notifyBorrowerOnBorrow: getBooleanFormValue(formData, "notifyBorrowerOnBorrow"),
      notifyBorrowerOnReturn: getBooleanFormValue(formData, "notifyBorrowerOnReturn"),
      notifyAdminOnBorrow: getBooleanFormValue(formData, "notifyAdminOnBorrow"),
      notifyAdminOnReturn: getBooleanFormValue(formData, "notifyAdminOnReturn"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exchange Email Service settings could not be saved.";
    redirect(`/settings/exchange-email?error=${encodeURIComponent(message)}`);
  }

  redirect("/settings/exchange-email?saved=true");
}

async function clearExchangeEmailClientSecretAction() {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserSettingsPermissionContext();

  if (!permissionContext.canViewSettings) {
    redirect("/dashboard");
  }

  await clearExchangeEmailClientSecret();
  redirect("/settings/exchange-email?saved=true");
}

async function sendTestEmailAction(
  _state: ExchangeTestEmailState,
  formData: FormData,
): Promise<ExchangeTestEmailState> {
  "use server";

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const permissionContext = await getCurrentUserSettingsPermissionContext();

  if (!permissionContext.canViewSettings) {
    return { ok: false, message: "You do not have permission to send test email." };
  }

  const recipient = String(formData.get("testRecipient") ?? "").trim();

  if (!recipient) {
    return { ok: false, message: "Enter a test recipient email address." };
  }

  const result = await sendExchangeTestEmail(recipient);

  if (result.sent > 0) {
    return { ok: true, message: "Test email sent." };
  }

  if (result.skipped > 0) {
    return { ok: false, message: "Test email was skipped because Exchange Email Service configuration is incomplete." };
  }

  return { ok: false, message: "Test email could not be sent. See notification history for the sanitized failure." };
}

export default async function ExchangeEmailSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const savedParam = resolvedSearchParams?.saved;
  const errorParam = resolvedSearchParams?.error;
  const initialSaved = Array.isArray(savedParam) ? savedParam.includes("true") : savedParam === "true";
  const initialError = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  const [setupState, currentUser, permissionContext] = await Promise.all([
    readSetupState(),
    getCurrentUser(),
    getCurrentUserSettingsPermissionContext(),
  ]);

  if (!setupState?.isCompleted) {
    redirect("/setup");
  }

  if (!currentUser) {
    redirect("/login");
  }

  if (!permissionContext.canViewSettings) {
    redirect("/dashboard");
  }

  const settings = await getExchangeEmailSettings();

  return (
    <AppShell>
      <ExchangeEmailSettingsPanel
        initialError={initialError}
        initialSaved={initialSaved}
        saveExchangeEmailSettingsAction={saveExchangeEmailSettingsAction}
        clearClientSecretAction={clearExchangeEmailClientSecretAction}
        sendTestEmailAction={sendTestEmailAction}
        settings={settings}
      />
    </AppShell>
  );
}
