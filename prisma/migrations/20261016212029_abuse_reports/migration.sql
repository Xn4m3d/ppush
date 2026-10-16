-- CreateTable
CREATE TABLE "AbuseReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "pushId" TEXT,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "ip" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" DATETIME,
    "handledBy" TEXT
);

-- CreateIndex
CREATE INDEX "AbuseReport_status_createdAt_idx" ON "AbuseReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AbuseReport_slug_idx" ON "AbuseReport"("slug");
