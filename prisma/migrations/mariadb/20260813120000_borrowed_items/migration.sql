-- CreateTable
CREATE TABLE `BorrowedItem` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NULL,
    `activeAssetId` VARCHAR(191) NULL,
    `itemName` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `borrowerUserId` VARCHAR(191) NOT NULL,
    `borrowedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NOT NULL,
    `returnedAt` DATETIME(3) NULL,
    `issuedByUserId` VARCHAR(191) NOT NULL,
    `returnedByUserId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BorrowedItem_activeAssetId_key`(`activeAssetId`),
    INDEX `BorrowedItem_assetId_idx`(`assetId`),
    INDEX `BorrowedItem_borrowerUserId_returnedAt_idx`(`borrowerUserId`, `returnedAt`),
    INDEX `BorrowedItem_dueAt_idx`(`dueAt`),
    INDEX `BorrowedItem_issuedByUserId_idx`(`issuedByUserId`),
    INDEX `BorrowedItem_returnedByUserId_idx`(`returnedByUserId`),
    CONSTRAINT `BorrowedItem_item_source_chk` CHECK (
        (`assetId` IS NOT NULL AND `itemName` IS NULL)
        OR (`assetId` IS NULL AND `itemName` IS NOT NULL)
    ),
    CONSTRAINT `BorrowedItem_quantity_positive_chk` CHECK (`quantity` > 0),
    CONSTRAINT `BorrowedItem_asset_quantity_chk` CHECK (`assetId` IS NULL OR `quantity` = 1),
    CONSTRAINT `BorrowedItem_active_asset_chk` CHECK (`activeAssetId` IS NULL OR `activeAssetId` = `assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BorrowedItem` ADD CONSTRAINT `BorrowedItem_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `BorrowedItem` ADD CONSTRAINT `BorrowedItem_activeAssetId_fkey` FOREIGN KEY (`activeAssetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `BorrowedItem` ADD CONSTRAINT `BorrowedItem_borrowerUserId_fkey` FOREIGN KEY (`borrowerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BorrowedItem` ADD CONSTRAINT `BorrowedItem_issuedByUserId_fkey` FOREIGN KEY (`issuedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BorrowedItem` ADD CONSTRAINT `BorrowedItem_returnedByUserId_fkey` FOREIGN KEY (`returnedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
