import Link from "next/link";
import {
  calendarEntries,
  nutriumAgendaUpdatedAt,
  upcomingBookings,
  type CalendarEntry,
} from "@/lib/backoffice/agenda";
import { verifySession } from "@/lib/backoffice/session";
import { addDays, lisbonToUtc, todayInLisbon, weekdayOf } from "@/lib/booking/time";
import { dayHref, dayKey, EntryCard, EntryChip, Legend, timeFmt } from "./AgendaViews";

type View = "dia" | "semana" | "mes" | "pendentes";
const VIEWS: Record<View, string> = { dia: "Dia", semana: "Semana", mes: "Mês", pendentes: "Por confirmar" };
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fmt = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-PT", { ...opts, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Segunda-feira da semana de `date`. */
const mondayOf = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));
const firstOfMonth = (date: string) => `${date.slice(0, 7)}-01`;
function shiftMonth(date: string, delta: number) {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

/** Dias a mostrar e período anterior/seguinte, conforme a vista. */
function period(view: Exclude<View, "pendentes">, date: string) {
  if (view === "dia") {
    return { days: [date], prev: addDays(date, -1), next: addDays(date, 1), label: capitalize(fmt(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })) };
  }
  if (view === "semana") {
    const start = mondayOf(date);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const end = days[6];
    const sameMonth = start.slice(0, 7) === end.slice(0, 7);
    const short = (d: string) => `${fmt(d, { day: "numeric" })} ${fmt(d, { month: "short" }).replace(".", "")}`;
    const label = sameMonth
      ? `${fmt(start, { day: "numeric" })}–${fmt(end, { day: "numeric", month: "long", year: "numeric" })}`
      : `${short(start)} – ${short(end)} ${end.slice(0, 4)}`;
    return { days, prev: addDays(start, -7), next: addDays(start, 7), label };
  }
  const first = firstOfMonth(date);
  const gridStart = mondayOf(first);
  const nextMonth = shiftMonth(first, 1);
  const days: string[] = [];
  for (let d = gridStart; d < nextMonth || weekdayOf(d) !== 1; d = addDays(d, 1)) days.push(d);
  return { days, prev: shiftMonth(first, -1), next: nextMonth, label: capitalize(fmt(first, { month: "long", year: "numeric" })) };
}

/** Minutos desde a última agenda do Nutrium (null se nunca chegou). */
async function nutriumAgeMinutes() {
  const at = await nutriumAgendaUpdatedAt().catch(() => null);
  return at ? Math.round((Date.now() - at.getTime()) / 60000) : null;
}

async function loadEntries(view: View, p: ReturnType<typeof period> | null) {
  try {
    const pending = (await upcomingBookings()).filter((b) => b.status === "pendente");
    const entries: CalendarEntry[] = p
      ? await calendarEntries(lisbonToUtc(p.days[0], "00:00"), lisbonToUtc(addDays(p.days.at(-1)!, 1), "00:00"))
      : pending.map((b) => ({ key: b.uid, start: b.start, end: b.end, nome: b.nome, source: "cal", booking: b, nutriumStatus: null, diff: null }));
    return { entries, pendingCount: pending.length, error: false };
  } catch (err) {
    console.error(`[backoffice/agenda] ${view}`, err);
    return { entries: [] as CalendarEntry[], pendingCount: 0, error: true };
  }
}

function Freshness({ minutes }: { minutes: number | null }) {
  if (minutes === null) {
    return (
      <p className="bo-diff">
        Ainda não chegou nenhuma agenda do Nutrium. Abre o Nutrium no Chrome com a extensão para aparecer aqui.
      </p>
    );
  }
  const ago = minutes < 60 ? `há ${minutes} min` : minutes < 48 * 60 ? `há ${Math.round(minutes / 60)} h` : `há ${Math.round(minutes / 1440)} dias`;
  return (
    <p className={minutes > 24 * 60 ? "bo-diff" : "bo-muted bo-small"}>
      Consultas do Nutrium atualizadas {ago} pela extensão
      {minutes > 24 * 60 && " — abre o Nutrium no Chrome para atualizar"}.
    </p>
  );
}

export default async function AgendaPage({ searchParams }: PageProps<"/backoffice">) {
  await verifySession();
  const params = await searchParams;
  const view: View = typeof params.vista === "string" && params.vista in VIEWS ? (params.vista as View) : "semana";
  const today = todayInLisbon();
  const date = typeof params.data === "string" && DATE_RE.test(params.data) ? params.data : today;

  const p = view === "pendentes" ? null : period(view, date);
  const [minutes, { entries, pendingCount, error }] = await Promise.all([nutriumAgeMinutes(), loadEntries(view, p)]);
  const byDay = Map.groupBy(entries, (e) => dayKey(e.start));
  const href = (v: View, d = date) => `/backoffice?vista=${v}&data=${d}`;

  return (
    <>
      <h1>Agenda</h1>
      <nav className="bo-tabs" aria-label="Vista">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={href(v)} aria-current={v === view ? "page" : undefined}>
            {VIEWS[v]}
            {v === "pendentes" && pendingCount > 0 && ` (${pendingCount})`}
          </Link>
        ))}
      </nav>

      {p && (
        <div className="bo-period">
          <Link className="bo-btn bo-btn-ghost bo-btn-small" href={href(view, p.prev)} aria-label="Anterior">‹</Link>
          <strong>{p.label}</strong>
          <Link className="bo-btn bo-btn-ghost bo-btn-small" href={href(view, p.next)} aria-label="Seguinte">›</Link>
          <Link className="bo-btn bo-btn-ghost bo-btn-small" href={href(view, today)}>Hoje</Link>
        </div>
      )}
      <Freshness minutes={minutes} />
      {p && <Legend />}
      {error && <p className="bo-error">Não foi possível ler as marcações do Cal.com. Tenta de novo daqui a pouco.</p>}

      {view === "pendentes" && !error && (
        entries.length ? entries.map((e) => <EntryCard key={e.key} e={e} />) : <p className="bo-empty">Nada por confirmar. 🎉</p>
      )}

      {view === "dia" && !error && (
        entries.length ? entries.map((e) => <EntryCard key={e.key} e={e} />) : <p className="bo-empty">Sem consultas neste dia.</p>
      )}

      {view === "semana" && p && (
        <div className="bo-week">
          {p.days.map((d) => (
            <section key={d} className={`bo-week-day${d === today ? " bo-today" : ""}`}>
              <Link href={dayHref(d)} className="bo-week-head">
                <span>{capitalize(fmt(d, { weekday: "short" }))}</span> <strong>{fmt(d, { day: "numeric" })}</strong>
              </Link>
              {(byDay.get(d) ?? []).map((e) => <EntryChip key={e.key} e={e} />)}
              {!byDay.get(d)?.length && <span className="bo-muted bo-small bo-week-empty">—</span>}
            </section>
          ))}
        </div>
      )}

      {view === "mes" && p && (
        <div className="bo-month">
          {WEEKDAYS.map((w) => (
            <div key={w} className="bo-month-weekday">{w}</div>
          ))}
          {p.days.map((d) => {
            const items = byDay.get(d) ?? [];
            const outside = d.slice(0, 7) !== date.slice(0, 7);
            return (
              <Link key={d} href={dayHref(d)} className={`bo-month-day${outside ? " bo-outside" : ""}${d === today ? " bo-today" : ""}`}>
                <span className="bo-month-num">{fmt(d, { day: "numeric" })}</span>
                {items.slice(0, 3).map((e) => (
                  <span key={e.key} className={`bo-entry bo-src-${e.source}${e.booking?.status === "pendente" ? " bo-entry-pending" : ""}`}>
                    <time>{timeFmt.format(new Date(e.start))}</time>
                    <span className="bo-entry-name">{e.nome}</span>
                  </span>
                ))}
                {items.length > 3 && <span className="bo-muted bo-small">+{items.length - 3}</span>}
                {items.length > 0 && <span className="bo-month-count">{items.length}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
