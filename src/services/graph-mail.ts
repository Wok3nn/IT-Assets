import "server-only";

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

function sanitizeGraphError(value: unknown) {
  if (!value) {
    return "Microsoft Graph request failed.";
  }

  if (typeof value === "string") {
    return value.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]").slice(0, 500);
  }

  try {
    return JSON.stringify(value)
      .replace(/"access_token"\s*:\s*"[^"]+"/gi, "\"access_token\":\"[redacted]\"")
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
      .slice(0, 500);
  } catch {
    return "Microsoft Graph request failed.";
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
    throw new GraphMailError(`Microsoft Graph token request failed: ${sanitizeGraphError(body.error_description ?? body.error ?? response.statusText)}`);
  }

  return body.access_token;
}

export async function sendGraphMail(config: ExchangeEmailRuntimeConfig, message: GraphMailMessage) {
  const accessToken = await requestGraphAccessToken(config);
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
    const body = await sendResponse.json().catch(() => ({}));
    throw new GraphMailError(`Microsoft Graph sendMail failed: ${sanitizeGraphError(body)}`);
  }
}

export function sanitizeMailError(error: unknown) {
  if (error instanceof Error) {
    return sanitizeGraphError(error.message);
  }

  return sanitizeGraphError(error);
}
