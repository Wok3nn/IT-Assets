-- CreateTable
CREATE TABLE `BorrowedItemNotification` (
    `id` VARCHAR(191) NOT NULL,
    `borrowedItemId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BorrowedItemNotification_borrowedItemId_type_status_idx`(`borrowedItemId`, `type`, `status`),
    INDEX `BorrowedItemNotification_type_status_createdAt_idx`(`type`, `status`, `createdAt`),
    INDEX `BorrowedItemNotification_recipient_idx`(`recipient`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BorrowedItemNotification` ADD CONSTRAINT `BorrowedItemNotification_borrowedItemId_fkey` FOREIGN KEY (`borrowedItemId`) REFERENCES `BorrowedItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
