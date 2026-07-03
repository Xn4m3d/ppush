-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyStat" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "pushes" INTEGER NOT NULL DEFAULT 0,
    "pushesAnon" INTEGER NOT NULL DEFAULT 0,
    "pushesApi" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_DailyStat" ("date", "pushes", "pushesAnon", "signups", "views") SELECT "date", "pushes", "pushesAnon", "signups", "views" FROM "DailyStat";
DROP TABLE "DailyStat";
ALTER TABLE "new_DailyStat" RENAME TO "DailyStat";
CREATE TABLE "new_Push" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "apiTokenId" TEXT,
    "apiTokenName" TEXT,
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
    CONSTRAINT "Push_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Push_apiTokenId_fkey" FOREIGN KEY ("apiTokenId") REFERENCES "ApiToken" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Push" ("blobPath", "ciphertext", "createdAt", "deletableByViewer", "expireAfterMinutes", "expireAfterViews", "expireReason", "expiredAt", "expiresAt", "fileSize", "id", "kind", "note", "passphraseHash", "payloadDeleted", "retrievalStep", "slug", "userId", "views") SELECT "blobPath", "ciphertext", "createdAt", "deletableByViewer", "expireAfterMinutes", "expireAfterViews", "expireReason", "expiredAt", "expiresAt", "fileSize", "id", "kind", "note", "passphraseHash", "payloadDeleted", "retrievalStep", "slug", "userId", "views" FROM "Push";
DROP TABLE "Push";
ALTER TABLE "new_Push" RENAME TO "Push";
CREATE UNIQUE INDEX "Push_slug_key" ON "Push"("slug");
CREATE INDEX "Push_userId_createdAt_idx" ON "Push"("userId", "createdAt");
CREATE INDEX "Push_expiresAt_idx" ON "Push"("expiresAt");
CREATE INDEX "Push_source_createdAt_idx" ON "Push"("source", "createdAt");
CREATE INDEX "Push_apiTokenId_idx" ON "Push"("apiTokenId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill the origin of pre-existing pushes: those without an account become
-- ANON. API origin cannot be reconstructed retroactively (it was not stored),
-- so account pushes stay at the 'WEB' default.
UPDATE "Push" SET "source" = 'ANON' WHERE "userId" IS NULL;
