import Link from "next/link";
import type { AgendaItem, CalendarEntry, NutriumState } from "@/lib/backoffice/agenda";
import BookingActions from "./BookingActions";

// Peças da agenda do backoffice (componentes de servidor).

const tz = { timeZone: "Europe/Lisbon" } as const;
export const timeFmt = new Intl.DateTimeFormat("pt-PT", { ...tz, hour: "2-digit", minute: "2-digit" });
export const dayKey = (iso: string | Date) => new Intl.DateTimeFormat("en-CA", tz).format(new Date(iso));

const NUTRIUM_STATUS = ["confirmada", "não confirmada", "cancelada"];
const SOURCE: Record<CalendarEntry["source"], string> = { cal: "Cal.com", nutrium: "Nutrium", ambos: "Cal.com + Nutrium" };
const STATUS_CHIP: Record<AgendaItem["status"], string> = {
  confirmada: "bo-chip-ok",
  pendente: "bo-chip-media",
  cancelada: "",
  recusada: "",
};
const NUTRIUM: Record<NutriumState, [string, string] | null> = {
  "no-nutrium": ["No Nutrium", "bo-chip-ok"],
  "por-atualizar": ["Por atualizar no Nutrium", "bo-chip-media"],
  "por-criar": ["Ainda não está no Nutrium", "bo-chip-alta"],
  "nao-aplicavel": null,
};

export function dayHref(date: string) {
  return `/backoffice?vista=dia&data=${date}`;
}

/** Cartão completo (vista Dia e Por confirmar), com as ações do Cal.com. */
export function EntryCard({ e }: { e: CalendarEntry }) {
  const b = e.booking;
  const actions = !b
    ? []
    : b.status === "pendente"
      ? (["confirmar", "recusar"] as const)
      : b.status === "confirmada"
        ? (["cancelar"] as const)
        : [];
  const nutrium = b && e.source === "cal" ? NUTRIUM[b.nutrium] : null;
  return (
    <article className={`bo-card bo-booking bo-src-${e.source}`}>
      <time dateTime={e.start}>
        {timeFmt.format(new Date(e.start))}
        <span className="bo-muted bo-small">{timeFmt.format(new Date(e.end))}</span>
      </time>
      <div>
        <strong>{e.nome}</strong>
        {b && (
          <div className="bo-muted bo-small">{[b.consulta, b.local, b.telefone, b.email].filter(Boolean).join(" · ")}</div>
        )}
        {b?.motivo && <div className="bo-small">“{b.motivo}”</div>}
        <div className="bo-chips">
          <span className={`bo-chip bo-chip-src-${e.source}`}>{SOURCE[e.source]}</span>
          {b && <span className={`bo-chip ${STATUS_CHIP[b.status]}`}>Cal.com · {b.status}</span>}
          {e.nutriumStatus !== null && (
            <span className={`bo-chip ${e.nutriumStatus === 0 ? "bo-chip-ok" : "bo-chip-media"}`}>
              Nutrium · {NUTRIUM_STATUS[e.nutriumStatus]}
            </span>
          )}
          {nutrium && <span className={`bo-chip ${nutrium[1]}`}>{nutrium[0]}</span>}
        </div>
        {e.diff && <p className="bo-diff">⚠ {e.diff} — corrige na agenda da extensão.</p>}
      </div>
      {b && actions.length > 0 && <BookingActions uid={b.uid} actions={[...actions]} />}
    </article>
  );
}

/** Linha compacta (vistas Semana e Mês). */
export function EntryChip({ e, withTime = true }: { e: CalendarEntry; withTime?: boolean }) {
  const pending = e.booking?.status === "pendente";
  return (
    <Link href={dayHref(dayKey(e.start))} className={`bo-entry bo-src-${e.source}${pending ? " bo-entry-pending" : ""}`}>
      {withTime && <time>{timeFmt.format(new Date(e.start))}</time>}
      <span className="bo-entry-name">{e.nome}</span>
      {(pending || e.diff) && <span className="bo-entry-flag">{e.diff ? "⚠" : "?"}</span>}
    </Link>
  );
}

export function Legend() {
  return (
    <div className="bo-legend bo-small">
      <span className="bo-entry bo-src-cal">Cal.com</span>
      <span className="bo-entry bo-src-ambos">Cal.com + Nutrium</span>
      <span className="bo-entry bo-src-nutrium">Só no Nutrium</span>
      <span className="bo-entry bo-entry-pending">? por confirmar</span>
    </div>
  );
}
