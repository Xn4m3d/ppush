-- RedefineTables: expireAfterDays (jours) → expireAfterMinutes (minutes).
-- Conversion des données existantes : minutes = jours * 1440.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Push" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "ciphertext" BLOB,
    "blobPath" TEXT,
    "fileSize" INTEGER,
    "payloadDeleted" BOOLEAN NOT NULL DEFAULT false,
    "passphraseHash" TEXT,
    "expireAfterViews" INTEGER NOT NULL,
    "expireAfterMinutes" INTEGER NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "retrievalStep" BOOLEAN NOT NULL DEFAULT true,
    "deletableByViewer" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "expiredAt" DATETIME,
    "expireReason" TEXT,
    CONSTRAINT "Push_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Push" ("blobPath", "ciphertext", "createdAt", "deletableByViewer", "expireAfterMinutes", "expireAfterViews", "expireReason", "expiredAt", "expiresAt", "fileSize", "id", "kind", "note", "passphraseHash", "payloadDeleted", "retrievalStep", "slug", "userId", "views") SELECT "blobPath", "ciphertext", "createdAt", "deletableByViewer", "expireAfterDays" * 1440, "expireAfterViews", "expireReason", "expiredAt", "expiresAt", "fileSize", "id", "kind", "note", "passphraseHash", "payloadDeleted", "retrievalStep", "slug", "userId", "views" FROM "Push";
DROP TABLE "Push";
ALTER TABLE "new_Push" RENAME TO "Push";
CREATE UNIQUE INDEX "Push_slug_key" ON "Push"("slug");
CREATE INDEX "Push_userId_createdAt_idx" ON "Push"("userId", "createdAt");
CREATE INDEX "Push_expiresAt_idx" ON "Push"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
