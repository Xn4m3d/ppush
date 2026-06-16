-- CreateTable
CREATE TABLE "DailyStat" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "pushes" INTEGER NOT NULL DEFAULT 0,
    "pushesAnon" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0
);
