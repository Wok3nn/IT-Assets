PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "serialNumber" TEXT,
    "notes" TEXT,
    "purchaseDate" DATETIME,
    "warrantyExpiry" DATETIME,
    "categoryId" TEXT,
    "statusId" TEXT,
    "assignedUserId" TEXT,
    "assignedLocationId" TEXT,
    "labelTemplateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "AssetStatus" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_assignedLocationId_fkey" FOREIGN KEY ("assignedLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_labelTemplateId_fkey" FOREIGN KEY ("labelTemplateId") REFERENCES "LabelTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Asset" (
    "id",
    "name",
    "assetTag",
    "serialNumber",
    "notes",
    "purchaseDate",
    "warrantyExpiry",
    "categoryId",
    "statusId",
    "assignedUserId",
    "assignedLocationId",
    "labelTemplateId",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "assetTag",
    "serialNumber",
    "notes",
    "purchaseDate",
    "warrantyExpiry",
    "categoryId",
    "statusId",
    "assignedUserId",
    "assignedLocationId",
    "labelTemplateId",
    "createdAt",
    "updatedAt"
FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_assetTag_key" ON "Asset"("assetTag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
