import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "./config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const url =
    process.env.DATABASE_URL ?? `file:${path.join(config.dataDir, "ppush.db")}`;
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
