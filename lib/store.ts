import { promises as fs } from "fs";
import path from "path";
import { createClient, type RedisClientType } from "redis";

// Estado pequeno do site: contadores com expiração (limites de tentativas e de pedidos),
// mapas JSON (sincronização com o Nutrium), chaves de idempotência e registos curtos (webhooks).
// Em produção usa Redis (REDIS_URL, criado pela integração Redis da Vercel).
// Sem essa variável, guarda tudo num ficheiro JSON local (.data/db.json) — só para desenvolvimento.

const redisUrl = process.env.REDIS_URL;
let client: Promise<RedisClientType> | undefined;

function getClient() {
  client ??= createClient({ url: redisUrl })
    .on("error", (err) => console.error("[redis]", err))
    .connect() as Promise<RedisClientType>;
  return client;
}

async function redis<T>(...command: string[]): Promise<T> {
  return (await (await getClient()).sendCommand(command)) as T;
}

type FileDb = Record<string, unknown>;
const DB_FILE = path.join(process.cwd(), ".data", "db.json");

async function readFileDb(): Promise<FileDb> {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeFileDb(db: FileDb) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

/** Incrementa um contador que expira `ttlSeconds` após o primeiro incremento. Devolve o novo valor. */
export async function incrementCounter(key: string, ttlSeconds: number): Promise<number> {
  if (redisUrl) {
    const count = await redis<number>("INCR", key);
    if (count === 1) await redis("EXPIRE", key, String(ttlSeconds));
    return count;
  }
  const db = await readFileDb();
  const now = Date.now();
  const entry = db[key] as { count: number; expiresAt: number } | undefined;
  const next = entry && entry.expiresAt > now
    ? { ...entry, count: entry.count + 1 }
    : { count: 1, expiresAt: now + ttlSeconds * 1000 };
  db[key] = next;
  await writeFileDb(db);
  return next.count;
}

export async function getCounter(key: string): Promise<number> {
  if (redisUrl) return Number((await redis<string | null>("GET", key)) ?? 0);
  const entry = (await readFileDb())[key] as { count: number; expiresAt: number } | undefined;
  return entry && entry.expiresAt > Date.now() ? entry.count : 0;
}

export async function deleteKey(key: string) {
  if (redisUrl) {
    await redis("DEL", key);
  } else {
    const db = await readFileDb();
    delete db[key];
    await writeFileDb(db);
  }
}

/** Todos os valores JSON guardados no mapa `key`, indexados pelo campo. */
export async function getMap<T>(key: string): Promise<Record<string, T>> {
  if (redisUrl) {
    const flat = await redis<string[]>("HGETALL", key);
    const map: Record<string, T> = {};
    for (let i = 0; i < flat.length; i += 2) map[flat[i]] = JSON.parse(flat[i + 1]);
    return map;
  }
  return ((await readFileDb())[key] ?? {}) as Record<string, T>;
}

export async function setMapEntry(key: string, field: string, value: unknown) {
  if (redisUrl) {
    await redis("HSET", key, field, JSON.stringify(value));
  } else {
    const db = await readFileDb();
    db[key] = { ...((db[key] ?? {}) as object), [field]: value };
    await writeFileDb(db);
  }
}

/** Reserva `key` durante `ttlSeconds`. Devolve false se já estava reservada (evento repetido). */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  if (redisUrl) return (await redis<string | null>("SET", key, "1", "NX", "EX", String(ttlSeconds))) === "OK";
  const db = await readFileDb();
  const entry = db[key] as { expiresAt: number } | undefined;
  if (entry && entry.expiresAt > Date.now()) return false;
  db[key] = { expiresAt: Date.now() + ttlSeconds * 1000 };
  await writeFileDb(db);
  return true;
}

/** Acrescenta `value` ao início da lista `key`, guardando só os `max` mais recentes. */
export async function pushLog(key: string, value: unknown, max: number) {
  if (redisUrl) {
    await redis("LPUSH", key, JSON.stringify(value));
    await redis("LTRIM", key, "0", String(max - 1));
  } else {
    const db = await readFileDb();
    db[key] = [value, ...((db[key] ?? []) as unknown[])].slice(0, max);
    await writeFileDb(db);
  }
}

export async function readLog<T>(key: string): Promise<T[]> {
  if (redisUrl) return (await redis<string[]>("LRANGE", key, "0", "-1")).map((v) => JSON.parse(v));
  return ((await readFileDb())[key] ?? []) as T[];
}
