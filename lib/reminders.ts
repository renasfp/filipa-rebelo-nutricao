import { listBookings } from "./booking/calcom";
import { TIMEZONE } from "./booking/time";
import { desc } from "drizzle-orm";
import { getDb, schema } from "./db";
import { claimOnce, releaseClaim } from "./store";

// Lembrete às clientes ~48h antes da consulta (corre de hora a hora, ver app/api/lembretes/route.ts).
// REMINDER_MODE: "simulacao" (por defeito — só regista o que enviaria) ou "whatsapp" (Meta Cloud API,
// com WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e o modelo aprovado WHATSAPP_TEMPLATE).

const EARLIEST_HOURS = 48;
// Uma consulta às 8h teria o lembrete às 8h; como só se envia entre QUIET_END e QUIET_START,
// a janela estende-se até 30h antes para o apanhar às 9h do dia anterior.
const LATEST_HOURS = 30;
const QUIET_END = 9;
const QUIET_START = 21;
const LOG_LIMIT = 300;

export type ReminderMode = "simulacao" | "whatsapp";

export interface ReminderParams {
  nome: string;
  data: string;
  hora: string;
  local: string;
}

export interface ReminderLogEntry {
  at: string;
  mode: ReminderMode;
  uid: string;
  start: string;
  /** Últimos dígitos do telefone, para identificar sem guardar o número. */
  telefone: string;
  ok: boolean;
  error?: string;
  texto: string;
}

export function reminderMode(): ReminderMode {
  return process.env.REMINDER_MODE === "whatsapp" ? "whatsapp" : "simulacao";
}

const dateFormat = new Intl.DateTimeFormat("pt-PT", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "numeric" });
const timeFormat = new Intl.DateTimeFormat("pt-PT", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" });
const hourInLisbon = (d: Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(d));

/** Texto do modelo de WhatsApp (o mesmo a submeter à Meta, com os parâmetros {{nome}}, …). */
export function reminderText(p: ReminderParams) {
  return (
    `Olá ${p.nome}, lembramos a sua consulta com a nutricionista Filipa Rebelo, marcada para ` +
    `${p.data}, às ${p.hora} (${p.local}). Se precisar de remarcar ou cancelar, use o link do email de confirmação.`
  );
}

async function sendWhatsApp(phone: string, p: ReminderParams) {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE = "lembrete_consulta" } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) throw new Error("WhatsApp não configurado");
  const res = await fetch(`https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone.replace(/\D/g, ""),
      type: "template",
      template: {
        name: WHATSAPP_TEMPLATE,
        language: { code: "pt_PT" },
        components: [
          {
            type: "body",
            parameters: Object.entries(p).map(([name, text]) => ({ type: "text", parameter_name: name, text })),
          },
        ],
      },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`WhatsApp ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
}

export interface ReminderRun {
  mode: ReminderMode;
  quietHours: boolean;
  sent: number;
  failed: number;
  skipped: { uid: string; reason: string }[];
}

/** Envia (ou simula) os lembretes que estão na janela; seguro para correr várias vezes por hora. */
export async function runReminders(now = new Date()): Promise<ReminderRun> {
  const mode = reminderMode();
  const run: ReminderRun = { mode, quietHours: false, sent: 0, failed: 0, skipped: [] };
  const hour = hourInLisbon(now);
  if (hour < QUIET_END || hour >= QUIET_START) return { ...run, quietHours: true };

  const bookings = await listBookings(now);
  for (const b of bookings) {
    const hoursAhead = (new Date(b.start).getTime() - now.getTime()) / 3600000;
    if (hoursAhead > EARLIEST_HOURS || hoursAhead < LATEST_HOURS) continue;
    if (b.status !== "accepted") {
      run.skipped.push({ uid: b.uid, reason: `estado ${b.status}` });
      continue;
    }
    if (b.metadata?.lembretes !== "sim") {
      run.skipped.push({ uid: b.uid, reason: "sem consentimento para lembretes" });
      continue;
    }
    const attendee = b.attendees[0];
    const phone = attendee?.phoneNumber ?? String(b.bookingFieldsResponses?.attendeePhoneNumber ?? "");
    if (!phone) {
      run.skipped.push({ uid: b.uid, reason: "sem telefone" });
      continue;
    }
    // Uma vez por marcação e por modo (a simulação não impede o envio real mais tarde).
    const claim = `lembrete:${mode}:${b.uid}`;
    if (!(await claimOnce(claim, 7 * 86400))) continue;

    const start = new Date(b.start);
    const local = String(b.bookingFieldsResponses?.Local ?? "");
    const params: ReminderParams = {
      nome: attendee.name.split(/\s+/)[0],
      data: dateFormat.format(start),
      hora: timeFormat.format(start),
      local: local || "Presencial",
    };
    const entry: ReminderLogEntry = {
      at: now.toISOString(),
      mode,
      uid: b.uid,
      start: b.start,
      telefone: `…${phone.replace(/\D/g, "").slice(-3)}`,
      ok: true,
      texto: reminderText(params),
    };
    try {
      if (mode === "whatsapp") await sendWhatsApp(phone, params);
      run.sent++;
    } catch (err) {
      entry.ok = false;
      entry.error = (err as Error).message;
      run.failed++;
      console.error("[lembretes]", b.uid, err);
      await releaseClaim(claim); // volta a tentar na hora seguinte, enquanto estiver na janela
    }
    const db = await getDb();
    await db.insert(schema.reminderLog).values({ ...entry, at: new Date(entry.at), error: entry.error ?? null });
  }
  return run;
}

export async function reminderLog(): Promise<ReminderLogEntry[]> {
  const db = await getDb();
  const l = schema.reminderLog;
  const rows = await db
    .select({ at: l.at, mode: l.mode, uid: l.uid, start: l.start, telefone: l.telefone, ok: l.ok, error: l.error, texto: l.texto })
    .from(l)
    .orderBy(desc(l.at))
    .limit(LOG_LIMIT);
  return rows.map((r) => ({ ...r, at: r.at.toISOString(), error: r.error ?? undefined }));
}
