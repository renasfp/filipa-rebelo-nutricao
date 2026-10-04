import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_CONFIG, type BookingConfig, type BookingRequest } from "./types";

// Em produção usa Redis (Upstash, via Vercel Marketplace) através da API REST.
// Sem essas variáveis, guarda tudo num ficheiro JSON local (.data/db.json) — só para desenvolvimento.

const CONFIG_KEY = "booking:config";
const REQUESTS_KEY = "booking:requests";

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis<T>(...command: string[]): Promise<T> {
  const res = await fetch(redisUrl!, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}` },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`Redis: ${body.error ?? res.status}`);
  return body.result as T;
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

export async function getConfig(): Promise<BookingConfig> {
  let stored: Partial<BookingConfig> | undefined;
  if (redisUrl) {
    const raw = await redis<string | null>("GET", CONFIG_KEY);
    stored = raw ? JSON.parse(raw) : undefined;
  } else {
    stored = (await readFileDb())[CONFIG_KEY] as Partial<BookingConfig> | undefined;
  }
  return { ...DEFAULT_CONFIG, ...stored };
}

export async function saveConfig(config: BookingConfig) {
  if (redisUrl) {
    await redis("SET", CONFIG_KEY, JSON.stringify(config));
  } else {
    const db = await readFileDb();
    db[CONFIG_KEY] = config;
    await writeFileDb(db);
  }
}

export async function listRequests(): Promise<BookingRequest[]> {
  let requests: BookingRequest[];
  if (redisUrl) {
    const flat = await redis<string[]>("HGETALL", REQUESTS_KEY);
    requests = flat.filter((_, i) => i % 2 === 1).map((v) => JSON.parse(v));
  } else {
    requests = Object.values(((await readFileDb())[REQUESTS_KEY] ?? {}) as Record<string, BookingRequest>);
  }
  return requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveRequest(request: BookingRequest) {
  if (redisUrl) {
    await redis("HSET", REQUESTS_KEY, request.id, JSON.stringify(request));
  } else {
    const db = await readFileDb();
    db[REQUESTS_KEY] = { ...((db[REQUESTS_KEY] ?? {}) as object), [request.id]: request };
    await writeFileDb(db);
  }
}

export async function getRequest(id: string): Promise<BookingRequest | undefined> {
  if (redisUrl) {
    const raw = await redis<string | null>("HGET", REQUESTS_KEY, id);
    return raw ? JSON.parse(raw) : undefined;
  }
  return ((await readFileDb())[REQUESTS_KEY] as Record<string, BookingRequest> | undefined)?.[id];
}
