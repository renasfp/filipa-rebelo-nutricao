import { createHash, timingSafeEqual } from "crypto";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import {
  cancelBooking,
  confirmBooking,
  listBookings,
  listEventTypes,
  rescheduleBooking,
  type CalBookingDetails,
} from "./booking/calcom";
import { clientIp, countFailure, overLimit, tooManyRequests } from "./rate-limit";
import { getDb, schema } from "./db";

// Ponte entre o Cal.com e a extensão do Chrome que cria as consultas no Nutrium.
// A extensão autentica-se com NUTRIUM_SYNC_TOKEN; a API key do Cal.com nunca sai do servidor.

const LOOKBACK_DAYS = 7;

const STATUS: Record<string, SyncBooking["status"]> = {
  accepted: "confirmada",
  pending: "pendente",
  cancelled: "cancelada",
  rejected: "recusada",
};

export interface SyncState {
  /** Identificador da consulta no Nutrium. */
  nutriumId: string;
  /** Identificador do cliente no Nutrium (necessário para alterar a consulta). */
  patientId: string;
  /** `version` da marcação na altura em que foi sincronizada. */
  version: string;
  syncedAt: string;
}

export interface SyncBooking {
  uid: string;
  status: "pendente" | "confirmada" | "cancelada" | "recusada";
  start: string;
  end: string;
  consulta: string;
  nome: string;
  email: string;
  telefone: string;
  nif: string;
  local: string;
  motivo: string;
  /** YYYY-MM-DD; vazio em marcações feitas antes de o site o pedir. */
  nascimento: string;
  genero: string;
  /** Muda sempre que algum dos dados acima muda; serve para detetar o que falta sincronizar. */
  version: string;
  synced: SyncState | null;
}

export function checkSyncToken(header: string | null) {
  const expected = process.env.NUTRIUM_SYNC_TOKEN;
  const given = header?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const MAX_TOKEN_FAILURES = 10;
const TOKEN_FAILURE_WINDOW = 15 * 60;

/** Autoriza um pedido da extensão (token), bloqueando o IP após várias tentativas falhadas. */
export async function authorizeSync(request: Request): Promise<Response | null> {
  const ip = clientIp(request.headers);
  if (await overLimit("token", ip, MAX_TOKEN_FAILURES)) return tooManyRequests();
  if (checkSyncToken(request.headers.get("authorization"))) return null;
  await countFailure("token", ip, TOKEN_FAILURE_WINDOW);
  return Response.json({ error: "Token inválido" }, { status: 401 });
}

function text(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalize(b: CalBookingDetails, titles: Map<string, string>, synced: SyncState | undefined): SyncBooking {
  const attendee = b.attendees[0] ?? { name: "", email: "" };
  const r = b.bookingFieldsResponses ?? {};
  const data = {
    uid: b.uid,
    status: STATUS[b.status] ?? "pendente",
    start: b.start,
    end: b.end,
    consulta: titles.get(b.eventType?.slug) ?? b.eventType?.slug ?? "",
    nome: attendee.name,
    email: attendee.email,
    telefone: attendee.phoneNumber ?? text(r.attendeePhoneNumber),
    nif: text(r.NIF),
    local: text(r.Local),
    motivo: text(r.notes),
    nascimento: text(b.metadata?.nascimento),
    genero: text(b.metadata?.genero),
  };
  const version = createHash("sha1").update(JSON.stringify(data)).digest("hex").slice(0, 12);
  return { ...data, version, synced: synced ?? null };
}

async function syncStates(): Promise<Record<string, SyncState>> {
  const db = await getDb();
  const rows = await db.select().from(schema.nutriumSync);
  return Object.fromEntries(
    rows.map((r) => [
      r.uid,
      { nutriumId: r.nutriumId, patientId: r.patientId, version: r.version, syncedAt: r.syncedAt.toISOString() },
    ]),
  );
}

/** Marcações desde há uma semana, com o estado da última sincronização de cada uma. */
export function listSyncBookings(): Promise<SyncBooking[]> {
  return listSyncBookingsBetween(new Date(Date.now() - LOOKBACK_DAYS * 86400000));
}

/** Marcações num intervalo (ex.: a semana ou o mês da agenda do backoffice). */
export async function listSyncBookingsBetween(from: Date, to?: Date): Promise<SyncBooking[]> {
  const [bookings, types, state] = await Promise.all([listBookings(from, to), listEventTypes(), syncStates()]);
  const titles = new Map(types.map((t) => [t.slug, t.title]));
  return bookings.map((b) => normalize(b, titles, state[b.uid]));
}

export async function markSynced(uid: string, state: Omit<SyncState, "syncedAt">) {
  const db = await getDb();
  const row = { ...state, syncedAt: new Date() };
  await db
    .insert(schema.nutriumSync)
    .values({ uid, ...row })
    .onConflictDoUpdate({ target: schema.nutriumSync.uid, set: row });
}

export type CalAction = "confirm" | "cancel" | "reschedule";

/**
 * Aplica no Cal.com uma alteração feita no Nutrium (confirmar, cancelar ou mudar a hora) e regista
 * as marcações afetadas como já sincronizadas, para a extensão não a repetir no Nutrium.
 */
export async function applyFromNutrium(uid: string, action: CalAction, start?: Date) {
  const before = (await listSyncBookings()).find((b) => b.uid === uid);
  if (!before?.synced) throw new Error("Marcação desconhecida ou ainda não sincronizada com o Nutrium.");
  const { nutriumId, patientId } = before.synced;
  const reason = "Alterado no Nutrium pela nutricionista";

  let newUid = uid;
  if (action === "confirm") await confirmBooking(uid);
  else if (action === "cancel") await cancelBooking(uid, reason);
  else newUid = (await rescheduleBooking(uid, start!, reason)).uid;

  const after = await listSyncBookings();
  for (const b of after.filter((b) => b.uid === uid || b.uid === newUid)) {
    await markSynced(b.uid, { nutriumId, patientId, version: b.version });
  }
  return after.find((b) => b.uid === newUid) ?? null;
}

// ─── Agenda do Nutrium (enviada pela extensão) ───────────────────────────────

const AGENDA_STATE_KEY = "nutrium-agenda";

export interface NutriumAppointment {
  id: string;
  start: string;
  end: string;
  nome: string;
  /** 0 confirmada, 1 não confirmada, 2 cancelada. */
  status: number;
}

/** Substitui a cópia da agenda do Nutrium no intervalo [from, to] pelo que a extensão leu. */
export async function saveNutriumAgenda(from: Date, to: Date, appointments: NutriumAppointment[]) {
  const db = await getDb();
  const t = schema.nutriumAppointments;
  await db.delete(t).where(and(gte(t.start, from), lte(t.start, to)));
  if (appointments.length) {
    await db
      .insert(t)
      .values(
        appointments.map((a) => ({
          id: a.id,
          start: new Date(a.start),
          end: new Date(a.end),
          patientName: a.nome,
          status: a.status,
        })),
      )
      .onConflictDoUpdate({
        target: t.id,
        set: {
          start: sql`excluded.start`,
          end: sql`excluded.end`,
          patientName: sql`excluded.patient_name`,
          status: sql`excluded.status`,
          receivedAt: sql`now()`,
        },
      });
  }
  const value = { from: from.toISOString(), to: to.toISOString(), count: appointments.length };
  await db
    .insert(schema.appState)
    .values({ key: AGENDA_STATE_KEY, value })
    .onConflictDoUpdate({ target: schema.appState.key, set: { value, updatedAt: new Date() } });
}

export async function nutriumAgendaBetween(from: Date, to: Date): Promise<NutriumAppointment[]> {
  const db = await getDb();
  const t = schema.nutriumAppointments;
  const rows = await db
    .select()
    .from(t)
    .where(and(gte(t.start, from), lt(t.start, to)));
  return rows.map((r) => ({
    id: r.id,
    start: r.start.toISOString(),
    end: r.end.toISOString(),
    nome: r.patientName,
    status: r.status,
  }));
}

/** Quando chegou a última agenda do Nutrium (null se nunca). */
export async function nutriumAgendaUpdatedAt(): Promise<Date | null> {
  const db = await getDb();
  const [row] = await db
    .select({ updatedAt: schema.appState.updatedAt })
    .from(schema.appState)
    .where(eq(schema.appState.key, AGENDA_STATE_KEY));
  return row?.updatedAt ?? null;
}
