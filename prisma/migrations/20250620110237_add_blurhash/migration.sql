-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AvatarProfileImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageUrl" TEXT NOT NULL,
    "blurHash" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AvatarProfileImage" ("id", "imageUrl", "updatedAt") SELECT "id", "imageUrl", "updatedAt" FROM "AvatarProfileImage";
DROP TABLE "AvatarProfileImage";
ALTER TABLE "new_AvatarProfileImage" RENAME TO "AvatarProfileImage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
