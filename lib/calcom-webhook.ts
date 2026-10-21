import { createHash, createHmac, timingSafeEqual } from "crypto";
import { desc } from "drizzle-orm";
import { getDb, schema } from "./db";
import { claimOnce } from "./store";

// Webhooks do Cal.com (Settings → Developer → Webhooks), assinados com CALCOM_WEBHOOK_SECRET.
// Para já só regista os eventos; os fluxos que dependem deles (cancelamentos, pagamentos,
// lembretes) passam a reagir aqui.

const LOG_LIMIT = 200;
const DEDUPE_SECONDS = 7 * 86400;

export interface CalWebhookEvent {
  triggerEvent: string;
  createdAt: string;
  payload: {
    uid?: string;
    bookingId?: number;
    startTime?: string;
    endTime?: string;
    status?: string;
    rescheduleUid?: string;
    [key: string]: unknown;
  };
}

/** Resumo guardado de cada evento (sem dados pessoais da cliente). */
export interface CalWebhookLogEntry {
  receivedAt: string;
  triggerEvent: string;
  uid: string | null;
  status: string | null;
  startTime: string | null;
  rescheduleUid: string | null;
  duplicate: boolean;
}

/** Valida o cabeçalho x-cal-signature-256: HMAC-SHA256 (hex) do corpo, com o segredo do webhook. */
export function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = createHash("sha256").update(signature.trim().toLowerCase()).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Regista o evento; devolve false se for repetido (o Cal.com pode reenviar o mesmo evento). */
export async function recordEvent(event: CalWebhookEvent): Promise<boolean> {
  const p = event.payload ?? {};
  const id = createHash("sha256")
    .update(`${event.triggerEvent}|${p.uid ?? p.bookingId ?? ""}|${event.createdAt}`)
    .digest("hex");
  const fresh = await claimOnce(`calcom:webhook:${id}`, DEDUPE_SECONDS);
  const db = await getDb();
  await db.insert(schema.webhookEvents).values({
    triggerEvent: event.triggerEvent,
    uid: p.uid ?? null,
    status: p.status ?? null,
    startTime: p.startTime ?? null,
    rescheduleUid: p.rescheduleUid ?? null,
    duplicate: !fresh,
  });
  return fresh;
}

export async function recentEvents(): Promise<CalWebhookLogEntry[]> {
  const db = await getDb();
  const e = schema.webhookEvents;
  const rows = await db
    .select({
      receivedAt: e.receivedAt,
      triggerEvent: e.triggerEvent,
      uid: e.uid,
      status: e.status,
      startTime: e.startTime,
      rescheduleUid: e.rescheduleUid,
      duplicate: e.duplicate,
    })
    .from(e)
    .orderBy(desc(e.receivedAt))
    .limit(LOG_LIMIT);
  return rows.map((r) => ({ ...r, receivedAt: r.receivedAt.toISOString() }));
}
