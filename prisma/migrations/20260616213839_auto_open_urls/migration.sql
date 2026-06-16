-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    "totpSecret" TEXT,
    "totpEnabledAt" DATETIME,
    "totpLastStep" INTEGER,
    "defaultDays" INTEGER NOT NULL DEFAULT 7,
    "defaultViews" INTEGER NOT NULL DEFAULT 5,
    "defaultRetrievalStep" BOOLEAN NOT NULL DEFAULT true,
    "defaultDeletableByViewer" BOOLEAN NOT NULL DEFAULT true,
    "autoOpenUrls" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("active", "approvedAt", "createdAt", "defaultDays", "defaultDeletableByViewer", "defaultRetrievalStep", "defaultViews", "email", "id", "lastLoginAt", "name", "passwordHash", "role", "totpEnabledAt", "totpLastStep", "totpSecret") SELECT "active", "approvedAt", "createdAt", "defaultDays", "defaultDeletableByViewer", "defaultRetrievalStep", "defaultViews", "email", "id", "lastLoginAt", "name", "passwordHash", "role", "totpEnabledAt", "totpLastStep", "totpSecret" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
