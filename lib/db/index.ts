import "server-only";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Produção: Neon (DATABASE_URL, criada pela integração Vercel → Storage → Neon); as migrações
// correm no build (scripts/migrate.mjs). Desenvolvimento: sem DATABASE_URL usa PGlite (Postgres
// embutido) em .data/pglite e aplica as migrações de drizzle/ ao arrancar.

export type Db = NeonHttpDatabase<typeof schema>;

let db: Promise<Db> | undefined;

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return drizzleNeon(neon(url), { schema });
  if (process.env.VERCEL) throw new Error("DATABASE_URL em falta: cria a base de dados em Vercel → Storage → Neon.");

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const local = drizzle(new PGlite(path.join(process.cwd(), ".data", "pglite")), { schema });
  await migrate(local, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  // A API de consultas é a mesma; só o tipo do driver difere.
  return local as unknown as Db;
}

export function getDb() {
  db ??= connect();
  return db;
}

export { schema };
