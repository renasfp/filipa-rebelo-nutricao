import "server-only";

// TEMPORÁRIO (4.11): copia do Redis antigo para o Postgres a ligação Cal.com ↔ Nutrium.
// Corre uma vez, quando a tabela nutrium_sync está vazia e ainda existe REDIS_URL.
// Depois de confirmada a cópia em produção, apagar este ficheiro, a dependência "redis" e a
// integração Redis na Vercel.

export interface LegacySyncState {
  nutriumId: string;
  patientId?: string;
  version: string;
  syncedAt?: string;
}

export async function readLegacyNutriumSync(): Promise<Record<string, LegacySyncState>> {
  const url = process.env.REDIS_URL;
  if (!url) return {};
  const { createClient } = await import("redis");
  const client = createClient({ url });
  await client.connect();
  try {
    const flat = await client.hGetAll("nutrium:sync");
    return Object.fromEntries(Object.entries(flat).map(([uid, json]) => [uid, JSON.parse(json)]));
  } finally {
    await client.quit();
  }
}
