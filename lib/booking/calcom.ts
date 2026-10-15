import { TIMEZONE } from "./time";

// Cliente mínimo da API v2 do Cal.com (https://cal.com/docs/api-reference/v2).
// CALCOM_USERNAME: dono dos tipos de evento (um por local de consulta).
// CALCOM_API_KEY: necessária para ler o horário de trabalho (horários ocupados riscados).

const API = "https://api.cal.com/v2";
const CONFIG_CACHE_SECONDS = 300;

export interface CalEventType {
  id: number;
  slug: string;
  title: string;
  lengthInMinutes: number;
  slotInterval?: number | null;
  /** Minutos. */
  minimumBookingNotice?: number;
  bookingWindow?: CalBookingWindow | CalBookingWindow[] | null;
  scheduleId: number | null;
  hidden: boolean;
  locations: { type: string; address?: string; public?: boolean; integration?: string; link?: string }[];
}

export type CalBookingWindow =
  | { type: "businessDays" | "calendarDays"; value: number; rolling?: boolean }
  | { type: "range"; value: [string, string] };

export interface CalSchedule {
  timeZone: string;
  availability: { days: string[]; startTime: string; endTime: string }[];
  overrides: { date: string; startTime: string; endTime: string }[];
}

export interface CalBooking {
  uid: string;
  status: string;
}

export class CalError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function cal<T>(
  path: string,
  version: string,
  { auth = false, revalidate, ...init }: RequestInit & { auth?: boolean; revalidate?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "cal-api-version": version,
    // A Cloudflare do Cal.com responde 403 ao User-Agent por defeito do Node.
    "User-Agent": "filipa-rebelo-nutricao-site",
  };
  if (init.body) headers["Content-Type"] = "application/json";
  if (auth) {
    if (!process.env.CALCOM_API_KEY) throw new CalError(401, "CALCOM_API_KEY não está configurada.");
    headers.Authorization = `Bearer ${process.env.CALCOM_API_KEY}`;
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
    ...(revalidate ? { next: { revalidate } } : { cache: "no-store" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message ?? body?.message ?? res.statusText;
    throw new CalError(res.status, `Cal.com ${path}: ${message}`);
  }
  return body.data as T;
}

export async function listEventTypes(): Promise<CalEventType[]> {
  const username = process.env.CALCOM_USERNAME;
  if (!username) return [];
  const params = new URLSearchParams({ username, sortCreatedAt: "asc" });
  const types = await cal<CalEventType[]>(`/event-types?${params}`, "2024-06-14", {
    revalidate: CONFIG_CACHE_SECONDS,
  });
  return types.filter((t) => !t.hidden);
}

/** Horário de trabalho do tipo de evento (ou o horário por defeito). null sem API key. */
export async function getSchedule(scheduleId: number | null): Promise<CalSchedule | null> {
  if (!process.env.CALCOM_API_KEY) return null;
  return cal<CalSchedule>(scheduleId ? `/schedules/${scheduleId}` : "/schedules/default", "2024-06-11", {
    auth: true,
    revalidate: CONFIG_CACHE_SECONDS,
  });
}

/** Horários livres, agrupados por data (YYYY-MM-DD) em hora de Lisboa, como "HH:MM". */
export async function getFreeSlots(eventTypeId: number, from: string, to: string): Promise<Map<string, string[]>> {
  const params = new URLSearchParams({ eventTypeId: String(eventTypeId), start: from, end: to, timeZone: TIMEZONE });
  const data = await cal<Record<string, { start: string }[]>>(`/slots?${params}`, "2024-09-04");
  // Com timeZone, cada início vem como "2026-10-20T13:00:00.000+01:00".
  return new Map(Object.entries(data ?? {}).map(([date, slots]) => [date, slots.map((s) => s.start.slice(11, 16))]));
}

export async function createBooking(input: {
  eventTypeId: number;
  start: Date;
  name: string;
  email: string;
  phoneNumber: string;
  notes: string;
}): Promise<CalBooking> {
  return cal<CalBooking>("/bookings", "2024-08-13", {
    method: "POST",
    body: JSON.stringify({
      eventTypeId: input.eventTypeId,
      start: input.start.toISOString(),
      attendee: {
        name: input.name,
        email: input.email,
        phoneNumber: input.phoneNumber,
        timeZone: TIMEZONE,
        language: "pt",
      },
      bookingFieldsResponses: input.notes ? { notes: input.notes } : undefined,
      metadata: { origem: "site", telefone: input.phoneNumber },
    }),
  });
}
