import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;

export async function getSettings() {
  return (await db.settings.findUnique({ where: { id: 1 } })) ?? (await db.settings.create({ data: { id: 1 } }));
}

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, meta?: unknown) {
  await db.auditLog.create({ data: { actorId, action, entity, entityId, meta: meta === undefined ? null : JSON.stringify(meta) } });
}
