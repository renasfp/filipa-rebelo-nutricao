import { createHash, timingSafeEqual } from "crypto";
import { listBookings, listEventTypes, type CalBookingDetails } from "./booking/calcom";
import { getMap, setMapEntry } from "./store";

// Ponte entre o Cal.com e a extensão do Chrome que cria as consultas no Nutrium.
// A extensão autentica-se com NUTRIUM_SYNC_TOKEN; a API key do Cal.com nunca sai do servidor.

const SYNC_KEY = "nutrium:sync";
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
  };
  const version = createHash("sha1").update(JSON.stringify(data)).digest("hex").slice(0, 12);
  return { ...data, version, synced: synced ?? null };
}

/** Marcações desde há uma semana, com o estado da última sincronização de cada uma. */
export async function listSyncBookings(): Promise<SyncBooking[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000);
  const [bookings, types, state] = await Promise.all([
    listBookings(since),
    listEventTypes(),
    getMap<SyncState>(SYNC_KEY),
  ]);
  const titles = new Map(types.map((t) => [t.slug, t.title]));
  return bookings.map((b) => normalize(b, titles, state[b.uid]));
}

export async function markSynced(uid: string, state: Omit<SyncState, "syncedAt">) {
  await setMapEntry(SYNC_KEY, uid, { ...state, syncedAt: new Date().toISOString() } satisfies SyncState);
}
