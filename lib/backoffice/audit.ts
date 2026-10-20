import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requestMeta } from "./session";

/** Regista quem fez o quê (ver Registos → Auditoria). */
export async function audit(userId: string | null, action: string, target?: string | null, details?: object) {
  const db = await getDb();
  const { ip } = await requestMeta();
  await db.insert(schema.auditLog).values({ userId, action, target: target ?? null, details: details ?? null, ip });
}

export async function recentAudit(limit = 200) {
  const db = await getDb();
  return db
    .select({
      at: schema.auditLog.at,
      action: schema.auditLog.action,
      target: schema.auditLog.target,
      details: schema.auditLog.details,
      ip: schema.auditLog.ip,
      userName: schema.users.name,
    })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.userId))
    .orderBy(desc(schema.auditLog.at))
    .limit(limit);
}
