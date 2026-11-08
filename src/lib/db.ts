import { PrismaClient } from "@prisma/client";
import { cleanDbUrl } from "./dburl";

const g = globalThis as unknown as { prisma?: PrismaClient };
const clean = cleanDbUrl(process.env.DATABASE_URL);
export const db = g.prisma ?? new PrismaClient(clean.ok ? { datasources: { db: { url: clean.url } } } : undefined);
if (process.env.NODE_ENV !== "production") g.prisma = db;

export async function getSettings() {
  return (await db.settings.findUnique({ where: { id: 1 } })) ?? (await db.settings.create({ data: { id: 1 } }));
}

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, meta?: unknown) {
  await db.auditLog.create({ data: { actorId, action, entity, entityId, meta: meta === undefined ? null : JSON.stringify(meta) } });
}
