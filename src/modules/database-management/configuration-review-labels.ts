const labels: Record<string, string> = {
  "app.title": "Application name",
  "organization.appTitle": "Application name",
  "session.timeoutMinutes": "Session length (minutes)",
  "branding.logo.light": "Logo (light theme)",
  "branding.logo.dark": "Logo (dark theme)",
  "branding.icon.light": "Icon (light theme)",
  "branding.icon.dark": "Icon (dark theme)",
  "authentication.entra.clientId": "Microsoft Entra Client ID",
  "authentication.entra.redirectUri": "Microsoft Entra Redirect URL",
  "authentication.entra.secretReference": "Microsoft Entra Secret",
  "authentication.entra.clientSecret": "Microsoft Entra Secret",
  "authentication.entra.tenantId": "Microsoft Entra Tenant ID",
  "mail.tenantId": "Email Tenant ID",
  "mail.clientId": "Email Client ID",
  "mail.clientSecret": "Email Secret",
  "mail.clientSecretEncrypted": "Email Secret",
  "mail.senderMailbox": "Sender mailbox",
  "timeZone": "Timezone",
  "mail encryption key": "Email encryption key",
  "branding files": "Logos and icons",
};

export function configurationReviewLabel(key: string) {
  return labels[key] ?? "Other setting";
}
