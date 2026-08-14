import { Prisma } from "@prisma/client";

import {
  getApplicationTimeZone,
  getCalendarDateKey,
  getCalendarDateUtc,
  getDaysBetweenCalendarDates,
} from "@/modules/borrowed-items/borrowed-items-calendar";
import {
  BORROWED_ITEM_NOTIFICATION_STATUSES,
  BORROWED_ITEM_NOTIFICATION_TYPES,
  sendScheduledReminderNotification,
} from "@/modules/borrowed-items/borrowed-item-notifications.service";
import { getExchangeEmailSettings } from "@/modules/settings/exchange-email-settings.service";
import { db } from "@/services/database";

const FAILED_RETRY_AFTER_MS = 6 * 60 * 60 * 1000;
const PENDING_RECLAIM_AFTER_MS = 2 * 60 * 60 * 1000;

type ReminderCandidate = {
  id: string;
  itemName: string | null;
  quantity: number;
  dueAt: Date;
  asset: {
    assetTag: string;
    name: string;
    make: string | null;
    model: string | null;
  } | null;
  borrowerUser: {
    name: string;
    email: string;
  };
};

export type BorrowedReminderProcessSummary = {
  dryRun: boolean;
  eligible: number;
  claimed: number;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

function getEmptySummary(dryRun: boolean): BorrowedReminderProcessSummary {
  return {
    dryRun,
    eligible: 0,
    claimed: 0,
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
}

function combineSummary(total: BorrowedReminderProcessSummary, next: Partial<BorrowedReminderProcessSummary>) {
  total.eligible += next.eligible ?? 0;
  total.claimed += next.claimed ?? 0;
  total.attempted += next.attempted ?? 0;
  total.sent += next.sent ?? 0;
  total.failed += next.failed ?? 0;
  total.skipped += next.skipped ?? 0;
}

function getItemLabel(item: ReminderCandidate) {
  if (item.asset) {
    const descriptor = [item.asset.make, item.asset.model || item.asset.name].filter(Boolean).join(" ");
    return descriptor ? `${descriptor} (${item.asset.assetTag})` : `${item.asset.name} (${item.asset.assetTag})`;
  }

  return item.itemName ?? "Borrowed item";
}

function buildDedupeKey(itemId: string, type: string, occurrenceKey: string) {
  return `borrowed-item:${itemId}:${type.toLowerCase()}:${occurrenceKey}`;
}

async function tryClaimReminder(input: {
  borrowedItemId: string;
  dedupeKey: string;
  scheduledFor: Date;
  type: string;
  now: Date;
}) {
  try {
    await db.borrowedItemReminderDedupe.create({
      data: {
        dedupeKey: input.dedupeKey,
        borrowedItemId: input.borrowedItemId,
        type: input.type,
        scheduledFor: input.scheduledFor,
        status: BORROWED_ITEM_NOTIFICATION_STATUSES.PENDING,
        lastAttemptAt: input.now,
      },
    });
    return true;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }

  const existing = await db.borrowedItemReminderDedupe.findUnique({
    where: {
      dedupeKey: input.dedupeKey,
    },
    select: {
      status: true,
      lastAttemptAt: true,
    },
  });

  if (!existing || existing.status === BORROWED_ITEM_NOTIFICATION_STATUSES.SENT || existing.status === BORROWED_ITEM_NOTIFICATION_STATUSES.SKIPPED) {
    return false;
  }

  const retryCutoff = new Date(input.now.getTime() - FAILED_RETRY_AFTER_MS);
  const pendingCutoff = new Date(input.now.getTime() - PENDING_RECLAIM_AFTER_MS);
  const canRetryFailed = existing.status === BORROWED_ITEM_NOTIFICATION_STATUSES.FAILED && (!existing.lastAttemptAt || existing.lastAttemptAt <= retryCutoff);
  const canReclaimPending = existing.status === BORROWED_ITEM_NOTIFICATION_STATUSES.PENDING && (!existing.lastAttemptAt || existing.lastAttemptAt <= pendingCutoff);

  if (!canRetryFailed && !canReclaimPending) {
    return false;
  }

  const result = await db.borrowedItemReminderDedupe.updateMany({
    where: {
      dedupeKey: input.dedupeKey,
      status: existing.status,
      OR: [
        { lastAttemptAt: null },
        { lastAttemptAt: { lte: canRetryFailed ? retryCutoff : pendingCutoff } },
      ],
    },
    data: {
      status: BORROWED_ITEM_NOTIFICATION_STATUSES.PENDING,
      lastAttemptAt: input.now,
    },
  });

  return result.count === 1;
}

function buildDueReminderMessage(item: ReminderCandidate) {
  const itemLabel = getItemLabel(item);
  const textBody = [
    `Hello ${item.borrowerUser.name},`,
    "",
    "This is a reminder that the following item is due to be returned today:",
    "",
    `Item: ${itemLabel}`,
    `Quantity: ${item.quantity}`,
    `Expected Return: ${item.dueAt.toLocaleString()}`,
    "",
    "Please return the item when possible.",
    "",
    "Thank you.",
  ].join("\n");

  return {
    subject: `Borrowed item due today - ${itemLabel}`,
    textBody,
  };
}

function buildOverdueReminderMessage(item: ReminderCandidate, daysPastDue: number) {
  const itemLabel = getItemLabel(item);
  const textBody = [
    `Hello ${item.borrowerUser.name},`,
    "",
    "This is a reminder that the following borrowed item is overdue:",
    "",
    `Item: ${itemLabel}`,
    `Quantity: ${item.quantity}`,
    `Expected Return: ${item.dueAt.toLocaleString()}`,
    `Days Overdue: ${daysPastDue}`,
    "",
    "Please return the item when possible.",
    "",
    "Thank you.",
  ].join("\n");

  return {
    subject: `Borrowed item overdue - ${itemLabel}`,
    textBody,
  };
}

async function processReminder(input: {
  dryRun: boolean;
  item: ReminderCandidate;
  occurrenceKey: string;
  scheduledFor: Date;
  type: typeof BORROWED_ITEM_NOTIFICATION_TYPES.DUE_REMINDER | typeof BORROWED_ITEM_NOTIFICATION_TYPES.OVERDUE_REMINDER;
  now: Date;
  daysPastDue?: number;
}) {
  const dedupeKey = buildDedupeKey(input.item.id, input.type, input.occurrenceKey);

  if (input.dryRun) {
    return {
      eligible: 1,
      claimed: 0,
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const claimed = await tryClaimReminder({
    borrowedItemId: input.item.id,
    dedupeKey,
    scheduledFor: input.scheduledFor,
    type: input.type,
    now: input.now,
  });

  if (!claimed) {
    return {
      eligible: 1,
      claimed: 0,
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const message = input.type === BORROWED_ITEM_NOTIFICATION_TYPES.DUE_REMINDER
    ? buildDueReminderMessage(input.item)
    : buildOverdueReminderMessage(input.item, input.daysPastDue ?? 0);
  const result = await sendScheduledReminderNotification({
    borrowedItemId: input.item.id,
    dedupeKey,
    type: input.type,
    to: input.item.borrowerUser.email,
    subject: message.subject,
    textBody: message.textBody,
  });

  return {
    eligible: 1,
    claimed: 1,
    attempted: result.attempted,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
  };
}

export async function processBorrowedItemReminders(options?: { dryRun?: boolean; now?: Date }) {
  const dryRun = options?.dryRun ?? false;
  const now = options?.now ?? new Date();
  const summary = getEmptySummary(dryRun);
  const settings = await getExchangeEmailSettings();

  if (!settings.mailEnabled) {
    return summary;
  }

  if (!settings.dueReminderEnabled && !settings.overdueRemindersEnabled) {
    return summary;
  }

  const timeZone = getApplicationTimeZone();
  const todayKey = getCalendarDateKey(now, timeZone);
  const candidates = await db.borrowedItem.findMany({
    where: {
      returnedAt: null,
    },
    select: {
      id: true,
      itemName: true,
      quantity: true,
      dueAt: true,
      asset: {
        select: {
          assetTag: true,
          name: true,
          make: true,
          model: true,
        },
      },
      borrowerUser: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ dueAt: "asc" }, { borrowedAt: "asc" }],
    take: 5000,
  });

  for (const item of candidates) {
    const dueKey = getCalendarDateKey(item.dueAt, timeZone);

    if (settings.dueReminderEnabled && dueKey === todayKey) {
      combineSummary(summary, await processReminder({
        dryRun,
        item,
        occurrenceKey: dueKey,
        scheduledFor: getCalendarDateUtc(dueKey),
        type: BORROWED_ITEM_NOTIFICATION_TYPES.DUE_REMINDER,
        now,
      }));
      continue;
    }

    if (!settings.overdueRemindersEnabled || dueKey >= todayKey) {
      continue;
    }

    const daysPastDue = getDaysBetweenCalendarDates(dueKey, todayKey);

    if (daysPastDue > 0 && daysPastDue % settings.overdueReminderIntervalDays === 0) {
      combineSummary(summary, await processReminder({
        dryRun,
        item,
        occurrenceKey: todayKey,
        scheduledFor: getCalendarDateUtc(todayKey),
        type: BORROWED_ITEM_NOTIFICATION_TYPES.OVERDUE_REMINDER,
        now,
        daysPastDue,
      }));
    }
  }

  return summary;
}
