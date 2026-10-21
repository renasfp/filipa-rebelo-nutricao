import "server-only";
import { recentEvents } from "@/lib/calcom-webhook";
import { addDays, lisbonToUtc, todayInLisbon } from "@/lib/booking/time";
import {
  listSyncBookings,
  listSyncBookingsBetween,
  nutriumAgendaBetween,
  nutriumAgendaUpdatedAt,
  type SyncBooking,
} from "@/lib/nutrium-sync";
import { listPrices, recentPayments } from "@/lib/payments";
import { reminderLog, reminderMode } from "@/lib/reminders";

// Dados dos ecrãs "Agenda" e "Problemas": marcações do Cal.com com o estado no Nutrium.

export type NutriumState = "no-nutrium" | "por-atualizar" | "por-criar" | "nao-aplicavel";

export interface AgendaItem extends SyncBooking {
  nutrium: NutriumState;
}

const isActive = (b: SyncBooking) => b.status === "pendente" || b.status === "confirmada";

function nutriumState(b: SyncBooking): NutriumState {
  if (!b.synced) return isActive(b) ? "por-criar" : "nao-aplicavel";
  return b.synced.version === b.version ? "no-nutrium" : "por-atualizar";
}

/** Marcações a partir de hoje (hora de Lisboa), por ordem. */
export async function upcomingBookings(): Promise<AgendaItem[]> {
  const from = lisbonToUtc(todayInLisbon(), "00:00");
  return (await listSyncBookings())
    .filter((b) => new Date(b.start) >= from)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((b) => ({ ...b, nutrium: nutriumState(b) }));
}

export function endOfDayIn(days: number) {
  return lisbonToUtc(addDays(todayInLisbon(), days + 1), "00:00");
}

export interface Problem {
  /** "alta": precisa de ação já; "media": rever hoje; "info": só para saber. */
  severity: "alta" | "media" | "info";
  title: string;
  detail: string;
  /** Marcação relacionada (para ligar à agenda), se houver. */
  uid?: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export async function findProblems(isAdmin: boolean): Promise<Problem[]> {
  const problems: Problem[] = [];
  const now = Date.now();
  const bookings = await upcomingBookings();

  for (const b of bookings) {
    const hours = (new Date(b.start).getTime() - now) / 3600000;
    if (b.status === "pendente") {
      problems.push({
        severity: hours < 72 ? "alta" : "media",
        title: `Por confirmar: ${b.nome}`,
        detail: `${b.consulta} · ${when(b.start)}. Confirma ou recusa na Agenda; o horário fica bloqueado até lá.`,
        uid: b.uid,
      });
    }
    if (isActive(b) && hours < 14 * 24 && (b.nutrium === "por-criar" || b.nutrium === "por-atualizar")) {
      problems.push({
        severity: hours < 48 ? "alta" : "media",
        title: `${b.nutrium === "por-criar" ? "Ainda não está" : "Desatualizada"} no Nutrium: ${b.nome}`,
        detail: `${when(b.start)}. Abre o Nutrium no Chrome e carrega em "Sincronizar" na extensão.`,
        uid: b.uid,
      });
    }
  }

  for (const p of await recentPayments(100)) {
    if (!p.lateAfterRelease || p.status !== "pago") continue;
    problems.push({
      severity: "alta",
      title: "Pagamento recebido depois de a marcação ser libertada",
      detail: `${(p.amountCents / 100).toFixed(2)} € por ${p.method === "mbway" ? "MB WAY" : "Multibanco"} em ${when(p.paidAt!.toISOString())}. Contacta a cliente para remarcar ou devolver o valor (ver Pagamentos).`,
      uid: p.bookingUid,
    });
  }
  for (const t of await listPrices().catch(() => [])) {
    if (t.amountCents !== null) continue;
    problems.push({
      severity: "info",
      title: `Sem preço: ${t.title}`,
      detail: "As marcações deste tipo não pedem pagamento e ficam pendentes para confirmar à mão (ver Preços).",
    });
  }

  const weekAgo = now - 7 * 86400000;
  for (const r of await reminderLog()) {
    if (r.ok || new Date(r.at).getTime() < weekAgo) continue;
    problems.push({
      severity: "media",
      title: "Lembrete não enviado",
      detail: `Consulta de ${when(r.start)} (telefone ${r.telefone}): ${r.error}`,
      uid: r.uid,
    });
  }

  if (isAdmin) {
    const missing = [
      ["DATABASE_URL", "base de dados de produção (Vercel → Storage → Neon)"],
      ["CALCOM_WEBHOOK_SECRET", "webhooks do Cal.com"],
      ["NUTRIUM_SYNC_TOKEN", "extensão do Chrome"],
      ["CRON_SECRET", "lembretes de 48h"],
    ].filter(([name]) => !process.env[name]);
    for (const [name, what] of missing) {
      problems.push({ severity: "info", title: `Falta configurar ${name}`, detail: `Necessário para: ${what}.` });
    }
    if (reminderMode() === "simulacao") {
      problems.push({
        severity: "info",
        title: "Lembretes em modo simulação",
        detail: "Os lembretes são só registados, não enviados (REMINDER_MODE).",
      });
    }
    const events = await recentEvents();
    if (!events.some((e) => new Date(e.receivedAt).getTime() > weekAgo)) {
      problems.push({
        severity: "info",
        title: "Nenhum webhook do Cal.com nos últimos 7 dias",
        detail: "Se houve marcações, confirma a configuração do webhook no Cal.com.",
      });
    }
  }

  const order = { alta: 0, media: 1, info: 2 };
  return problems.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ─── Agenda por dia / semana / mês (Cal.com + Nutrium) ───────────────────────────────

export interface CalendarEntry {
  key: string;
  start: string;
  end: string;
  nome: string;
  /** Onde a consulta existe. */
  source: "cal" | "nutrium" | "ambos";
  /** Marcação do Cal.com (com o estado no Nutrium), se existir. */
  booking: AgendaItem | null;
  /** Estado no Nutrium (0 confirmada, 1 não confirmada, 2 cancelada), se existir lá. */
  nutriumStatus: number | null;
  /** Diferença entre o Cal.com e o Nutrium, em linguagem simples. */
  diff: string | null;
}

const shortWhen = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export async function calendarEntries(from: Date, to: Date): Promise<CalendarEntry[]> {
  const [bookings, appointments] = await Promise.all([
    listSyncBookingsBetween(from, to),
    nutriumAgendaBetween(from, to),
  ]);
  const byId = new Map(appointments.map((a) => [a.id, a]));
  const linked = new Set<string>();
  const entries: CalendarEntry[] = [];

  for (const raw of bookings) {
    const b: AgendaItem = { ...raw, nutrium: nutriumState(raw) };
    const a = b.synced ? byId.get(b.synced.nutriumId) : undefined;
    if (a) linked.add(a.id);
    const nutriumActive = a && a.status !== 2;
    if (!isActive(b) && !nutriumActive) continue;

    let diff: string | null = null;
    if (a && isActive(b)) {
      if (a.status === 2) diff = "Cancelada no Nutrium, ativa no Cal.com";
      else if (new Date(a.start).getTime() !== new Date(b.start).getTime()) diff = `No Nutrium está às ${shortWhen(a.start)}`;
    } else if (a && !isActive(b)) {
      diff = `${b.status === "recusada" ? "Recusada" : "Cancelada"} no Cal.com, ativa no Nutrium`;
    }
    entries.push({
      key: b.uid,
      start: b.start,
      end: b.end,
      nome: b.nome,
      source: a ? "ambos" : "cal",
      booking: b,
      nutriumStatus: a?.status ?? null,
      diff,
    });
  }

  for (const a of appointments) {
    if (linked.has(a.id) || a.status === 2) continue;
    entries.push({
      key: `n${a.id}`,
      start: a.start,
      end: a.end,
      nome: a.nome,
      source: "nutrium",
      booking: null,
      nutriumStatus: a.status,
      diff: null,
    });
  }
  return entries.sort((x, y) => x.start.localeCompare(y.start) || x.nome.localeCompare(y.nome));
}

export { nutriumAgendaUpdatedAt };
