ALTER TABLE `BorrowedItemNotification` ADD COLUMN `dedupeKey` VARCHAR(191) NULL;

CREATE TABLE `BorrowedItemReminderDedupe` (
    `dedupeKey` VARCHAR(191) NOT NULL,
    `borrowedItemId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `scheduledFor` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `notificationId` VARCHAR(191) NULL,
    `lastAttemptAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `BorrowedItemReminderDedupe_borrowedItemId_type_scheduledFor_idx`(`borrowedItemId`, `type`, `scheduledFor`),
    INDEX `BorrowedItemReminderDedupe_type_status_scheduledFor_idx`(`type`, `status`, `scheduledFor`),
    PRIMARY KEY (`dedupeKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `BorrowedItemNotification_dedupeKey_idx` ON `BorrowedItemNotification`(`dedupeKey`);

ALTER TABLE `BorrowedItemReminderDedupe` ADD CONSTRAINT `BorrowedItemReminderDedupe_borrowedItemId_fkey` FOREIGN KEY (`borrowedItemId`) REFERENCES `BorrowedItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
