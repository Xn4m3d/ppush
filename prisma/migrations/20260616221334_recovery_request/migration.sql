-- CreateTable
CREATE TABLE "RecoveryRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ip" TEXT,
    "userAgent" TEXT,
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" DATETIME,
    "handledBy" TEXT
);

-- CreateIndex
CREATE INDEX "RecoveryRequest_status_createdAt_idx" ON "RecoveryRequest"("status", "createdAt");
