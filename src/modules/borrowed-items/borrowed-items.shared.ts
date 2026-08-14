export type BorrowedItemListRecord = {
  id: string;
  assetId: string | null;
  activeAssetId: string | null;
  itemName: string | null;
  quantity: number;
  borrowerUserId: string;
  borrowedAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset: {
    id: string;
    assetTag: string;
    name: string;
    make: string | null;
    model: string | null;
  } | null;
  borrowerUser: {
    id: string;
    name: string;
    email: string;
  };
  issuedByUser: {
    id: string;
    name: string;
    email: string;
  };
  returnedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  notifications: BorrowedItemNotificationRecord[];
};

export type BorrowedItemNotificationRecord = {
  id: string;
  borrowedItemId: string | null;
  type: string;
  recipient: string;
  status: string;
  sentAt: Date | null;
  error: string | null;
  createdAt: Date;
};

function getTodayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return { start, tomorrow };
}

export function getBorrowedItemStatus(item: { dueAt: Date; returnedAt: Date | null }, now = new Date()) {
  if (item.returnedAt) {
    return "Returned";
  }

  const { start, tomorrow } = getTodayBounds(now);

  if (item.dueAt < start) {
    return "Overdue";
  }

  if (item.dueAt < tomorrow) {
    return "Due Today";
  }

  return "Active";
}

export function formatDateTimeLocalInput(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
