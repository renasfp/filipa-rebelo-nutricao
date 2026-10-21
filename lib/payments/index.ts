import "server-only";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import {
  confirmBooking,
  declineBooking,
  getBooking,
  listBookings,
  listEventTypes,
  type CalBookingDetails,
} from "@/lib/booking/calcom";
import { addDays, lisbonToUtc, todayInLisbon } from "@/lib/booking/time";
import { getDb, schema } from "@/lib/db";
import type { Payment, PaymentStatus } from "@/lib/db/schema";
import { claimOnce, releaseClaim } from "@/lib/store";
import { createMbway, createMultibanco, type EupagoWebhookTransaction } from "./eupago";

// Pagamento das marcações do site (cartão 2.2): a marcação fica pendente no Cal.com até o
// webhook da EuPago confirmar o pagamento; sem pagamento a tempo, é recusada e o horário liberta-se.

/** Tempo para começar a pagar depois de marcar (e para voltar a tentar depois de um MB WAY expirar). */
const HOLD_MINUTES = 30;
/** O MB WAY expira na app em ~5 min; damos margem ao webhook. */
const MBWAY_MINUTES = 7;
/** Multibanco só para consultas com pelo menos este tempo de antecedência. */
const MULTIBANCO_MIN_HOURS = 48;

const { prices, payments } = schema;

// ─── Preços ───────────────────────────────

export async function priceFor(eventTypeSlug: string): Promise<number | null> {
  const db = await getDb();
  const [row] = await db.select().from(prices).where(eq(prices.eventTypeSlug, eventTypeSlug));
  return row?.amountCents ?? null;
}

/** Tipos de consulta do Cal.com com o preço definido (ou null). */
export async function listPrices() {
  const db = await getDb();
  const [types, rows] = await Promise.all([listEventTypes(), db.select().from(prices)]);
  const bySlug = new Map(rows.map((r) => [r.eventTypeSlug, r]));
  return types.map((t) => ({
    slug: t.slug,
    title: t.title,
    lengthInMinutes: t.lengthInMinutes,
    amountCents: bySlug.get(t.slug)?.amountCents ?? null,
    updatedAt: bySlug.get(t.slug)?.updatedAt ?? null,
  }));
}

export async function setPrice(eventTypeSlug: string, amountCents: number | null, userId: string) {
  const db = await getDb();
  if (amountCents === null) {
    await db.delete(prices).where(eq(prices.eventTypeSlug, eventTypeSlug));
    return;
  }
  const values = { amountCents, updatedAt: new Date(), updatedBy: userId };
  await db
    .insert(prices)
    .values({ eventTypeSlug, ...values })
    .onConflictDoUpdate({ target: prices.eventTypeSlug, set: values });
}

// ─── Estado de uma marcação ───────────────────────────────

export function needsPayment(b: Pick<CalBookingDetails, "metadata">) {
  return b.metadata?.pagamento === "sim";
}

async function paymentsOf(uid: string) {
  const db = await getDb();
  return db.select().from(payments).where(eq(payments.bookingUid, uid)).orderBy(desc(payments.createdAt));
}

/** Até quando a marcação fica reservada sem pagamento confirmado. */
function holdDeadline(booking: CalBookingDetails, list: Payment[]) {
  const created = booking.createdAt ? new Date(booking.createdAt).getTime() : Date.now();
  const lastExpiry = Math.max(0, ...list.map((p) => p.expiresAt.getTime()));
  return new Date(Math.max(created + HOLD_MINUTES * 60000, lastExpiry + 15 * 60000));
}

const isOpen = (p: Payment, now = Date.now()) => p.status === "pendente" && p.expiresAt.getTime() > now;

export interface PaymentPageState {
  booking: CalBookingDetails;
  amountCents: number | null;
  payments: Payment[];
  /** Pagamento em curso (à espera da cliente), se houver. */
  open: Payment | null;
  paid: boolean;
  canMultibanco: boolean;
  holdUntil: Date;
}

export async function paymentPageState(uid: string): Promise<PaymentPageState | null> {
  const booking = await getBooking(uid);
  if (!booking || !needsPayment(booking)) return null;
  const [amountCents, list] = await Promise.all([priceFor(booking.eventType.slug), paymentsOf(uid)]);
  const now = Date.now();
  return {
    booking,
    amountCents,
    payments: list,
    open: list.find((p) => isOpen(p, now)) ?? null,
    paid: list.some((p) => p.status === "pago"),
    canMultibanco: new Date(booking.start).getTime() - now > MULTIBANCO_MIN_HOURS * 3600000,
    holdUntil: holdDeadline(booking, list),
  };
}

// ─── Iniciar um pagamento ───────────────────────────────

export class PaymentError extends Error {}

/** Telemóvel português com 9 dígitos (aceita +351 / 00351 e espaços). */
export function portuguesePhone(input: string) {
  const digits = input.replace(/\D/g, "").replace(/^(00)?351/, "");
  return /^9\d{8}$/.test(digits) ? digits : null;
}

export async function startPayment(uid: string, method: "mbway" | "multibanco", phoneInput = "") {
  const state = await paymentPageState(uid);
  if (!state) throw new PaymentError("Marcação não encontrada.");
  const { booking, amountCents } = state;
  if (booking.status !== "pending") throw new PaymentError("Esta marcação já não está à espera de pagamento.");
  if (state.paid) throw new PaymentError("Esta marcação já está paga.");
  if (state.open) throw new PaymentError("Já tens um pagamento em curso. Conclui-o ou espera que expire.");
  if (!amountCents) throw new PaymentError("O preço desta consulta ainda não está definido. Contacta-nos, por favor.");
  if (Date.now() > state.holdUntil.getTime()) throw new PaymentError("O prazo para pagar esta marcação terminou.");

  const db = await getDb();
  if (method === "mbway") {
    const phone = portuguesePhone(phoneInput);
    if (!phone) throw new PaymentError("Indica um número de telemóvel português válido (9 dígitos).");
    const [payment] = await db
      .insert(payments)
      .values({
        bookingUid: uid,
        method,
        amountCents,
        phoneHint: `…${phone.slice(-3)}`,
        expiresAt: new Date(Date.now() + MBWAY_MINUTES * 60000),
      })
      .returning();
    try {
      const { transactionId, reference } = await createMbway(payment.id, amountCents, phone);
      const [updated] = await db
        .update(payments)
        .set({ transactionId, reference, updatedAt: new Date() })
        .where(eq(payments.id, payment.id))
        .returning();
      return updated;
    } catch (err) {
      await db.update(payments).set({ status: "erro", updatedAt: new Date() }).where(eq(payments.id, payment.id));
      throw err;
    }
  }

  if (!state.canMultibanco) {
    throw new PaymentError(`O pagamento por Multibanco só está disponível para consultas a mais de ${MULTIBANCO_MIN_HOURS} horas.`);
  }
  // Pagável até ao fim do dia seguinte (hora de Lisboa).
  const deadline = addDays(todayInLisbon(), 1);
  const [payment] = await db
    .insert(payments)
    .values({ bookingUid: uid, method, amountCents, expiresAt: lisbonToUtc(addDays(deadline, 1), "00:00") })
    .returning();
  try {
    const { entity, reference } = await createMultibanco(payment.id, amountCents, deadline);
    const [updated] = await db
      .update(payments)
      .set({ entity, reference, updatedAt: new Date() })
      .where(eq(payments.id, payment.id))
      .returning();
    return updated;
  } catch (err) {
    await db.update(payments).set({ status: "erro", updatedAt: new Date() }).where(eq(payments.id, payment.id));
    throw err;
  }
}

// ─── Webhook ───────────────────────────────

const STATUS: Record<string, PaymentStatus> = {
  paid: "pago",
  pago: "pago",
  expired: "expirado",
  cancel: "cancelado",
  canceled: "cancelado",
  cancelled: "cancelado",
  error: "erro",
  refund: "reembolsado",
  refunded: "reembolsado",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function amountInCents(amount: EupagoWebhookTransaction["amount"]) {
  const raw = typeof amount === "object" && amount !== null ? (amount.value ?? amount.amount) : amount;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

export type WebhookOutcome =
  | "ignorado"
  | "repetido"
  | "estado-atualizado"
  | "confirmada"
  | "ja-confirmada"
  | "pago-apos-libertar"
  | "valor-errado";

/** Trata uma transação do webhook 2.0. Idempotente: o mesmo evento pode chegar várias vezes. */
export async function handlePaymentEvent(tx: EupagoWebhookTransaction): Promise<WebhookOutcome> {
  const status = STATUS[String(tx.status ?? "").toLowerCase()];
  if (!status || !tx.identifier || !UUID_RE.test(tx.identifier)) return "ignorado";
  const key = `eupago:${tx.trid ?? ""}:${tx.identifier}:${status}`;
  if (!(await claimOnce(key, 30 * 86400))) return "repetido";
  try {
    return await applyPaymentEvent(tx, tx.identifier, status);
  } catch (err) {
    await releaseClaim(key); // a EuPago volta a enviar; não perder o evento
    throw err;
  }
}

async function applyPaymentEvent(
  tx: EupagoWebhookTransaction,
  paymentId: string,
  status: PaymentStatus,
): Promise<WebhookOutcome> {
  const db = await getDb();
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment) return "ignorado";

  if (status !== "pago") {
    if (payment.status !== "pago") {
      await db.update(payments).set({ status, updatedAt: new Date() }).where(eq(payments.id, payment.id));
    } else if (status === "reembolsado") {
      await db.update(payments).set({ status, updatedAt: new Date() }).where(eq(payments.id, payment.id));
    }
    return "estado-atualizado";
  }

  const cents = amountInCents(tx.amount);
  if (cents !== null && cents < payment.amountCents) {
    console.error(`[pagamentos] valor recebido ${cents} < ${payment.amountCents} (${payment.id})`);
    await db.update(payments).set({ status: "erro", updatedAt: new Date() }).where(eq(payments.id, payment.id));
    return "valor-errado";
  }

  await db
    .update(payments)
    .set({ status: "pago", paidAt: new Date(), transactionId: String(tx.trid ?? payment.transactionId ?? ""), updatedAt: new Date() })
    .where(eq(payments.id, payment.id));

  const booking = await getBooking(payment.bookingUid);
  if (booking?.status === "pending") {
    await confirmBooking(payment.bookingUid);
    return "confirmada";
  }
  if (booking?.status === "accepted") return "ja-confirmada";
  // Recusada/cancelada entretanto (pagamento tardio): tem de ser devolvido ou remarcado à mão.
  await db.update(payments).set({ lateAfterRelease: true }).where(eq(payments.id, payment.id));
  return "pago-apos-libertar";
}

// ─── Libertar marcações sem pagamento ───────────────────────────────

/**
 * Marca como expirados os pagamentos fora de prazo e recusa no Cal.com as marcações pendentes
 * sem pagamento dentro do prazo. Chamada pelo cron e, no máximo de 2 em 2 minutos, ao consultar
 * a disponibilidade (para o horário ficar livre mesmo sem cron).
 */
export async function releaseExpiredBookings({ force = false } = {}) {
  if (!force && !(await claimOnce("tarefa:libertar-pagamentos", 120))) return { released: [] as string[] };
  const db = await getDb();
  const now = new Date();
  await db
    .update(payments)
    .set({ status: "expirado", updatedAt: now })
    .where(and(eq(payments.status, "pendente"), lt(payments.expiresAt, now)));

  const pending = (await listBookings(new Date(Date.now() - 7 * 86400000))).filter(
    (b) => b.status === "pending" && needsPayment(b),
  );
  if (!pending.length) return { released: [] };
  const all = await db.select().from(payments).where(inArray(payments.bookingUid, pending.map((b) => b.uid)));

  const released: string[] = [];
  for (const b of pending) {
    const list = all.filter((p) => p.bookingUid === b.uid);
    if (list.some((p) => p.status === "pago")) {
      // Pago mas por confirmar (ex.: o Cal.com falhou no webhook): tenta outra vez.
      await confirmBooking(b.uid).catch((err) => console.error("[pagamentos] confirmar", b.uid, err));
      continue;
    }
    if (list.some((p) => isOpen(p)) || now < holdDeadline(b, list)) continue;
    try {
      await declineBooking(b.uid, "Pagamento não recebido dentro do prazo. O horário foi libertado.");
      released.push(b.uid);
    } catch (err) {
      console.error("[pagamentos] libertar", b.uid, err);
    }
  }
  return { released };
}

export async function recentPayments(limit = 200) {
  const db = await getDb();
  return db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit);
}
