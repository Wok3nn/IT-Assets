PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "colorHex" TEXT,
    "colorMode" TEXT,
    "code" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Location" ("id", "name", "slug", "parentId", "colorHex", "colorMode", "code", "description", "createdAt", "updatedAt")
SELECT "id", "name", lower(replace("name", ' ', '-')), NULL, NULL, NULL, "code", "description", "createdAt", "updatedAt"
FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
