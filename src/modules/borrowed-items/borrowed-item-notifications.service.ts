import type { BorrowedItemListRecord } from "@/modules/borrowed-items/borrowed-items.shared";
import {
  getExchangeEmailRuntimeConfig,
  getExchangeEmailSettings,
} from "@/modules/settings/exchange-email-settings.service";
import { db } from "@/services/database";
import { sanitizeMailError, sendGraphMail } from "@/services/graph-mail";

export const BORROWED_ITEM_NOTIFICATION_TYPES = {
  BORROWED_USER: "BORROWED_USER",
  BORROWED_ADMIN: "BORROWED_ADMIN",
  RETURNED_USER: "RETURNED_USER",
  RETURNED_ADMIN: "RETURNED_ADMIN",
  TEST_EMAIL: "TEST_EMAIL",
  DUE_REMINDER: "DUE_REMINDER",
  OVERDUE_REMINDER: "OVERDUE_REMINDER",
} as const;

export const BORROWED_ITEM_NOTIFICATION_STATUSES = {
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
  PENDING: "PENDING",
} as const;

type NotificationType = (typeof BORROWED_ITEM_NOTIFICATION_TYPES)[keyof typeof BORROWED_ITEM_NOTIFICATION_TYPES];
type NotificationStatus = (typeof BORROWED_ITEM_NOTIFICATION_STATUSES)[keyof typeof BORROWED_ITEM_NOTIFICATION_STATUSES];

type NotificationSummary = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

type NotificationMessage = {
  borrowedItemId?: string | null;
  dedupeKey?: string | null;
  type: NotificationType;
  to?: string | null;
  subject: string;
  textBody: string;
  htmlBody?: string;
};

function getEmptySummary(): NotificationSummary {
  return { attempted: 0, sent: 0, failed: 0, skipped: 0 };
}

function combineSummaries(summaries: NotificationSummary[]) {
  return summaries.reduce((total, summary) => ({
    attempted: total.attempted + summary.attempted,
    sent: total.sent + summary.sent,
    failed: total.failed + summary.failed,
    skipped: total.skipped + summary.skipped,
  }), getEmptySummary());
}

function sanitizeRecipient(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || "";
}

function sanitizeHistoryError(value: string) {
  return value.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]").slice(0, 1000);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string) {
  return `<div>${escapeHtml(text).replace(/\n/g, "<br />")}</div>`;
}

function getItemLabel(item: BorrowedItemListRecord) {
  if (item.asset) {
    const descriptor = [item.asset.make, item.asset.model || item.asset.name].filter(Boolean).join(" ");
    return descriptor ? `${descriptor} (${item.asset.assetTag})` : `${item.asset.name} (${item.asset.assetTag})`;
  }

  return item.itemName ?? "Borrowed item";
}

function formatDateTimeLabel(value?: Date | null) {
  return value ? value.toLocaleString() : "Not recorded";
}

async function recordNotification(input: {
  borrowedItemId?: string | null;
  dedupeKey?: string | null;
  type: NotificationType;
  recipient: string;
  status: NotificationStatus;
  sentAt?: Date | null;
  error?: string | null;
}) {
  await db.borrowedItemNotification.create({
    data: {
      borrowedItemId: input.borrowedItemId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      type: input.type,
      recipient: input.recipient,
      status: input.status,
      sentAt: input.sentAt ?? null,
      error: input.error ? sanitizeHistoryError(input.error) : null,
    },
  });
}

async function updateReminderDedupe(input: {
  dedupeKey: string;
  notificationId?: string | null;
  status: NotificationStatus;
}) {
  await db.borrowedItemReminderDedupe.update({
    where: {
      dedupeKey: input.dedupeKey,
    },
    data: {
      notificationId: input.notificationId ?? null,
      status: input.status,
      lastAttemptAt: new Date(),
    },
  });
}

async function sendTrackedNotification(message: NotificationMessage): Promise<NotificationSummary> {
  const recipient = sanitizeRecipient(message.to);

  if (!recipient) {
    await recordNotification({
      borrowedItemId: message.borrowedItemId,
      type: message.type,
      recipient: "Not configured",
      status: BORROWED_ITEM_NOTIFICATION_STATUSES.SKIPPED,
      error: "No recipient address was configured.",
    });
    return { attempted: 0, sent: 0, failed: 0, skipped: 1 };
  }

  const runtimeConfig = await getExchangeEmailRuntimeConfig();

  if (!runtimeConfig) {
    await recordNotification({
      borrowedItemId: message.borrowedItemId,
      type: message.type,
      recipient,
      status: BORROWED_ITEM_NOTIFICATION_STATUSES.SKIPPED,
      error: "Exchange Email Service credentials or sender mailbox are not fully configured.",
    });
    return { attempted: 0, sent: 0, failed: 0, skipped: 1 };
  }

  try {
    await sendGraphMail(runtimeConfig, {
      to: recipient,
      subject: message.subject,
      textBody: message.textBody,
      htmlBody: message.htmlBody ?? textToHtml(message.textBody),
    });
    await recordNotification({
      borrowedItemId: message.borrowedItemId,
      type: message.type,
      recipient,
      status: BORROWED_ITEM_NOTIFICATION_STATUSES.SENT,
      sentAt: new Date(),
    });
    return { attempted: 1, sent: 1, failed: 0, skipped: 0 };
  } catch (error) {
    await recordNotification({
      borrowedItemId: message.borrowedItemId,
      type: message.type,
      recipient,
      status: BORROWED_ITEM_NOTIFICATION_STATUSES.FAILED,
      error: sanitizeMailError(error),
    });
    return { attempted: 1, sent: 0, failed: 1, skipped: 0 };
  }
}

export async function sendScheduledReminderNotification(message: NotificationMessage & { dedupeKey: string }): Promise<NotificationSummary> {
  const recipient = sanitizeRecipient(message.to);

  if (!recipient) {
    const notification = await db.borrowedItemNotification.create({
      data: {
        borrowedItemId: message.borrowedItemId ?? null,
        dedupeKey: message.dedupeKey,
        type: message.type,
        recipient: "Not configured",
        status: BORROWED_ITEM_NOTIFICATION_STATUSES.SKIPPED,
        error: "No borrower email address was configured.",
      },
      select: {
        id: true,
      },
    });
    await updateReminderDedupe({ dedupeKey: message.dedupeKey, notificationId: notification.id, status: BORROWED_ITEM_NOTIFICATION_STATUSES.SKIPPED });
    return { attempted: 0, sent: 0, failed: 0, skipped: 1 };
  }

  const runtimeConfig = await getExchangeEmailRuntimeConfig();

  if (!runtimeConfig) {
    const notification = await db.borrowedItemNotification.create({
      data: {
        borrowedItemId: message.borrowedItemId ?? null,
        dedupeKey: message.dedupeKey,
        type: message.type,
        recipient,
        status: BORROWED_ITEM_NOTIFICATION_STATUSES.SKIPPED,
        error: "Exchange Email Service credentials or sender mailbox are not fully configured.",
      },
      select: {
        id: true,
      },
    });
    await updateReminderDedupe({ dedupeKey: message.dedupeKey, notificationId: notification.id, status: BORROWED_ITEM_NOTIFICATION_STATUSES.SKIPPED });
    return { attempted: 0, sent: 0, failed: 0, skipped: 1 };
  }

  try {
    await sendGraphMail(runtimeConfig, {
      to: recipient,
      subject: message.subject,
      textBody: message.textBody,
      htmlBody: message.htmlBody ?? textToHtml(message.textBody),
    });
    const notification = await db.borrowedItemNotification.create({
      data: {
        borrowedItemId: message.borrowedItemId ?? null,
        dedupeKey: message.dedupeKey,
        type: message.type,
        recipient,
        status: BORROWED_ITEM_NOTIFICATION_STATUSES.SENT,
        sentAt: new Date(),
      },
      select: {
        id: true,
      },
    });
    await updateReminderDedupe({ dedupeKey: message.dedupeKey, notificationId: notification.id, status: BORROWED_ITEM_NOTIFICATION_STATUSES.SENT });
    return { attempted: 1, sent: 1, failed: 0, skipped: 0 };
  } catch (error) {
    const notification = await db.borrowedItemNotification.create({
      data: {
        borrowedItemId: message.borrowedItemId ?? null,
        dedupeKey: message.dedupeKey,
        type: message.type,
        recipient,
        status: BORROWED_ITEM_NOTIFICATION_STATUSES.FAILED,
        error: sanitizeMailError(error),
      },
      select: {
        id: true,
      },
    });
    await updateReminderDedupe({ dedupeKey: message.dedupeKey, notificationId: notification.id, status: BORROWED_ITEM_NOTIFICATION_STATUSES.FAILED });
    return { attempted: 1, sent: 0, failed: 1, skipped: 0 };
  }
}

export function buildNotificationWarning(summary: NotificationSummary) {
  if (summary.failed > 0) {
    return "One or more email notifications could not be sent.";
  }

  if (summary.skipped > 0) {
    return "One or more email notifications were skipped because configuration is incomplete.";
  }

  return null;
}

export async function sendBorrowedItemCreatedNotifications(item: BorrowedItemListRecord) {
  const settings = await getExchangeEmailSettings();

  if (!settings.mailEnabled) {
    return getEmptySummary();
  }

  const itemLabel = getItemLabel(item);
  const summaries: NotificationSummary[] = [];

  if (settings.notifyBorrowerOnBorrow) {
    const textBody = [
      `Hello ${item.borrowerUser.name},`,
      "",
      "The following item has been issued to you:",
      "",
      `Item: ${itemLabel}`,
      `Quantity: ${item.quantity}`,
      `Borrowed: ${formatDateTimeLabel(item.borrowedAt)}`,
      `Expected Return: ${formatDateTimeLabel(item.dueAt)}`,
      "",
      "Please return the item by the expected return date.",
      "",
      "Thank you.",
    ].join("\n");

    summaries.push(await sendTrackedNotification({
      borrowedItemId: item.id,
      type: BORROWED_ITEM_NOTIFICATION_TYPES.BORROWED_USER,
      to: item.borrowerUser.email,
      subject: `Item issued to you - ${itemLabel}`,
      textBody,
    }));
  }

  if (settings.notifyAdminOnBorrow) {
    const textBody = [
      `${item.borrowerUser.name} has borrowed:`,
      "",
      `Item: ${itemLabel}`,
      `Quantity: ${item.quantity}`,
      `Borrowed: ${formatDateTimeLabel(item.borrowedAt)}`,
      `Expected Return: ${formatDateTimeLabel(item.dueAt)}`,
      `Issued By: ${item.issuedByUser.name}`,
    ].join("\n");

    summaries.push(await sendTrackedNotification({
      borrowedItemId: item.id,
      type: BORROWED_ITEM_NOTIFICATION_TYPES.BORROWED_ADMIN,
      to: settings.adminRecipient,
      subject: `Borrowed Item - ${item.borrowerUser.name} - ${itemLabel}`,
      textBody,
    }));
  }

  return combineSummaries(summaries);
}

export async function sendBorrowedItemReturnedNotifications(item: BorrowedItemListRecord) {
  const settings = await getExchangeEmailSettings();

  if (!settings.mailEnabled) {
    return getEmptySummary();
  }

  const itemLabel = getItemLabel(item);
  const summaries: NotificationSummary[] = [];

  if (settings.notifyBorrowerOnReturn) {
    const textBody = [
      `Hello ${item.borrowerUser.name},`,
      "",
      "The following item has been marked as returned:",
      "",
      `Item: ${itemLabel}`,
      `Quantity: ${item.quantity}`,
      `Returned: ${formatDateTimeLabel(item.returnedAt)}`,
      "",
      "Thank you for returning the item.",
    ].join("\n");

    summaries.push(await sendTrackedNotification({
      borrowedItemId: item.id,
      type: BORROWED_ITEM_NOTIFICATION_TYPES.RETURNED_USER,
      to: item.borrowerUser.email,
      subject: `Item returned - ${itemLabel}`,
      textBody,
    }));
  }

  if (settings.notifyAdminOnReturn) {
    const textBody = [
      "The following borrowed item has been returned:",
      "",
      `Borrower: ${item.borrowerUser.name}`,
      `Item: ${itemLabel}`,
      `Quantity: ${item.quantity}`,
      `Returned: ${formatDateTimeLabel(item.returnedAt)}`,
      `Returned By: ${item.returnedByUser?.name ?? "Unknown"}`,
    ].join("\n");

    summaries.push(await sendTrackedNotification({
      borrowedItemId: item.id,
      type: BORROWED_ITEM_NOTIFICATION_TYPES.RETURNED_ADMIN,
      to: settings.adminRecipient,
      subject: `Returned Item - ${item.borrowerUser.name} - ${itemLabel}`,
      textBody,
    }));
  }

  return combineSummaries(summaries);
}

export async function sendExchangeTestEmail(to: string) {
  const textBody = [
    "This is a test email from IT Assets Tracker.",
    "",
    "If you received this message, the Exchange Email Service is configured correctly.",
  ].join("\n");

  return sendTrackedNotification({
    borrowedItemId: null,
    type: BORROWED_ITEM_NOTIFICATION_TYPES.TEST_EMAIL,
    to,
    subject: "IT Assets Tracker - Email Test",
    textBody,
  });
}
