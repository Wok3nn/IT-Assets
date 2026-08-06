-- CreateTable
CREATE TABLE `GuestProfile` (
    `id` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `guestType` VARCHAR(191) NOT NULL DEFAULT 'Guest',
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Asset` ADD COLUMN `assignedGuestProfileId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `GuestProfile_displayName_idx` ON `GuestProfile`(`displayName`);

-- CreateIndex
CREATE INDEX `GuestProfile_guestType_idx` ON `GuestProfile`(`guestType`);

-- CreateIndex
CREATE INDEX `GuestProfile_isActive_idx` ON `GuestProfile`(`isActive`);

-- CreateIndex
CREATE INDEX `Asset_assignedGuestProfileId_idx` ON `Asset`(`assignedGuestProfileId`);

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_assignedGuestProfileId_fkey` FOREIGN KEY (`assignedGuestProfileId`) REFERENCES `GuestProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
