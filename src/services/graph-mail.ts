import { control, managed } from "@/modules/database-management/control-store";
import type { ExchangeEmailRuntimeConfig } from "@/modules/settings/exchange-email-settings.service";

type GraphTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export type GraphMailMessage = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
};

export class GraphMailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphMailError";
  }
}

async function requestGraphAccessToken(config: ExchangeEmailRuntimeConfig) {
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  const body = await response.json().catch(() => ({})) as GraphTokenResponse;

  if (!response.ok || !body.access_token) {
    throw new GraphMailError(`Microsoft Graph token request failed (HTTP ${response.status}).`);
  }

  return body.access_token;
}

function assertActiveWorkspace() {
  if (!managed()) return;
  const state = control().state();
  if (!state.active || String(state.revision) !== process.env.IT_ASSETS_REVISION) throw new GraphMailError("Workspace changed; email was not dispatched.");
}

export async function sendGraphMail(config: ExchangeEmailRuntimeConfig, message: GraphMailMessage) {
  assertActiveWorkspace();
  const accessToken = await requestGraphAccessToken(config);
  assertActiveWorkspace();
  const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.senderMailbox)}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: message.subject,
        body: {
          contentType: message.htmlBody ? "HTML" : "Text",
          content: message.htmlBody ?? message.textBody,
        },
        toRecipients: [
          {
            emailAddress: {
              address: message.to,
            },
          },
        ],
      },
      saveToSentItems: true,
    }),
  });

  if (!sendResponse.ok) {
    throw new GraphMailError(`Microsoft Graph sendMail failed (HTTP ${sendResponse.status}).`);
  }
}

export function sanitizeMailError(error: unknown) {
  if (error instanceof GraphMailError && /^Microsoft Graph (?:token request|sendMail) failed \(HTTP \d{3}\)\.$/.test(error.message)) return error.message;
  return "Email transport failed. Check configuration and connectivity.";
}
