import Link from "next/link";
import { endOfDayIn, upcomingBookings, type AgendaItem, type NutriumState } from "@/lib/backoffice/agenda";
import { verifySession } from "@/lib/backoffice/session";
import BookingActions from "./BookingActions";

const VIEWS = {
  hoje: { label: "Hoje", match: (b: AgendaItem) => new Date(b.start) < endOfDayIn(0) },
  semana: { label: "7 dias", match: (b: AgendaItem) => new Date(b.start) < endOfDayIn(6) },
  pendentes: { label: "Por confirmar", match: (b: AgendaItem) => b.status === "pendente" },
  todas: { label: "Todas", match: () => true },
} as const;
type View = keyof typeof VIEWS;

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

const tz = { timeZone: "Europe/Lisbon" } as const;
const dayLabel = new Intl.DateTimeFormat("pt-PT", { ...tz, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("pt-PT", { ...tz, hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", tz);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Booking({ b }: { b: AgendaItem }) {
  const nutrium = NUTRIUM[b.nutrium];
  const actions =
    b.status === "pendente"
      ? (["confirmar", "recusar"] as const)
      : b.status === "confirmada"
        ? (["cancelar"] as const)
        : [];
  return (
    <article className="bo-card bo-booking">
      <time dateTime={b.start}>{time.format(new Date(b.start))}</time>
      <div>
        <strong>{b.nome}</strong>
        <div className="bo-muted bo-small">
          {[b.consulta, b.local, b.telefone, b.email].filter(Boolean).join(" · ")}
        </div>
        {b.motivo && <div className="bo-small">“{b.motivo}”</div>}
        <div className="bo-chips">
          <span className={`bo-chip ${STATUS_CHIP[b.status]}`}>{b.status}</span>
          {nutrium && <span className={`bo-chip ${nutrium[1]}`}>{nutrium[0]}</span>}
        </div>
      </div>
      {actions.length > 0 && <BookingActions uid={b.uid} actions={[...actions]} />}
    </article>
  );
}

export default async function AgendaPage({ searchParams }: PageProps<"/backoffice">) {
  await verifySession();
  const requested = (await searchParams).ver;
  const view: View = typeof requested === "string" && requested in VIEWS ? (requested as View) : "semana";

  let bookings: AgendaItem[] = [];
  let error = false;
  try {
    bookings = await upcomingBookings();
  } catch (err) {
    console.error("[backoffice/agenda]", err);
    error = true;
  }
  const visible = bookings.filter(
    (b) => VIEWS[view].match(b) && (view === "todas" || b.status === "pendente" || b.status === "confirmada"),
  );
  const days = Map.groupBy(visible, (b) => dayKey.format(new Date(b.start)));

  return (
    <>
      <h1>Agenda</h1>
      <nav className="bo-tabs" aria-label="Período">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={`/backoffice?ver=${v}`} aria-current={v === view ? "page" : undefined}>
            {VIEWS[v].label}
            {v === "pendentes" && ` (${bookings.filter(VIEWS.pendentes.match).length})`}
          </Link>
        ))}
      </nav>
      {error && <p className="bo-error">Não foi possível ler as marcações do Cal.com. Tenta de novo daqui a pouco.</p>}
      {!error && !visible.length && <p className="bo-empty">Sem marcações neste período.</p>}
      {[...days].map(([key, items]) => (
        <section key={key}>
          <h2 className="bo-day">{capitalize(dayLabel.format(new Date(items[0].start)))}</h2>
          {items.map((b) => (
            <Booking key={b.uid} b={b} />
          ))}
        </section>
      ))}
    </>
  );
}
