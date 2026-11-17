import { control, managed } from "../database-management/control-store";
import { deploymentTimeZone } from "../database-management/installation-timezone";

export function getApplicationTimeZone() {
  return (managed() ? control().timezone()?.timeZone : null) ?? deploymentTimeZone();
}

export function getCalendarDateKey(value: Date, timeZone = getApplicationTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function parseCalendarDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("Invalid calendar date key.");
  }

  return { year, month, day };
}

export function getCalendarDateUtc(value: string) {
  const { year, month, day } = parseCalendarDateKey(value);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getDaysBetweenCalendarDates(startKey: string, endKey: string) {
  const start = getCalendarDateUtc(startKey).getTime();
  const end = getCalendarDateUtc(endKey).getTime();
  return Math.floor((end - start) / 86_400_000);
}

export function getBorrowedItemCalendarStatus(item: { dueAt: Date; returnedAt: Date | null }, now = new Date(), timeZone = getApplicationTimeZone()) {
  if (item.returnedAt) {
    return "Returned";
  }

  const dueKey = getCalendarDateKey(item.dueAt, timeZone);
  const todayKey = getCalendarDateKey(now, timeZone);

  if (dueKey < todayKey) {
    return "Overdue";
  }

  if (dueKey === todayKey) {
    return "Due Today";
  }

  return "Active";
}
