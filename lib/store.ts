import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

// Estado pequeno do site, no Postgres: contadores com expiração (limites de pedidos e de
// tentativas) e chaves de idempotência (webhooks e lembretes processados uma só vez).

const { rateLimits, idempotencyKeys } = schema;

/** De vez em quando apaga linhas expiradas, para as tabelas não crescerem sem fim. */
async function sweep() {
  if (Math.random() > 0.02) return;
  const db = await getDb();
  const now = new Date();
  await db.delete(rateLimits).where(lt(rateLimits.expiresAt, now));
  await db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, now));
}

/** Incrementa um contador que expira `ttlSeconds` após o primeiro incremento. Devolve o novo valor. */
export async function incrementCounter(key: string, ttlSeconds: number): Promise<number> {
  const db = await getDb();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const live = sql`${rateLimits.expiresAt} > now()`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${live} then ${rateLimits.count} + 1 else 1 end`,
        expiresAt: sql`case when ${live} then ${rateLimits.expiresAt} else excluded.expires_at end`,
      },
    })
    .returning({ count: rateLimits.count });
  await sweep();
  return row.count;
}

export async function getCounter(key: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), gt(rateLimits.expiresAt, new Date())));
  return row?.count ?? 0;
}

export async function resetCounter(key: string) {
  const db = await getDb();
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

/** Reserva `key` durante `ttlSeconds`. Devolve false se já estava reservada (evento repetido). */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  const db = await getDb();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  // Insere; se já existir mas estiver expirada, renova. Se existir e estiver válida, não devolve nada.
  const rows = await db
    .insert(idempotencyKeys)
    .values({ key, expiresAt })
    .onConflictDoUpdate({
      target: idempotencyKeys.key,
      set: { expiresAt },
      setWhere: sql`${idempotencyKeys.expiresAt} <= now()`,
    })
    .returning({ key: idempotencyKeys.key });
  await sweep();
  return rows.length > 0;
}

export async function releaseClaim(key: string) {
  const db = await getDb();
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
}
