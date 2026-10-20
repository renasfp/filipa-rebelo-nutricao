import Link from "next/link";
import { recentAudit } from "@/lib/backoffice/audit";
import { verifySession } from "@/lib/backoffice/session";
import { recentEvents } from "@/lib/calcom-webhook";
import { reminderLog, reminderMode } from "@/lib/reminders";

const TABS = { auditoria: "Auditoria", webhooks: "Webhooks do Cal.com", lembretes: "Lembretes" } as const;
type Tab = keyof typeof TABS;

const fmt = (d: Date | string) =>
  new Date(d).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "medium" });

async function Audit() {
  const rows = await recentAudit();
  if (!rows.length) return <p className="bo-empty">Sem registos.</p>;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <thead>
          <tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Alvo</th><th>IP</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{fmt(r.at)}</td>
              <td>{r.userName ?? "—"}</td>
              <td>
                {r.action}
                {r.details ? <div className="bo-muted bo-small">{JSON.stringify(r.details)}</div> : null}
              </td>
              <td>{r.target ?? ""}</td>
              <td className="bo-muted">{r.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Webhooks() {
  const rows = await recentEvents();
  if (!rows.length) return <p className="bo-empty">Ainda não chegou nenhum webhook.</p>;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <thead>
          <tr><th>Recebido</th><th>Evento</th><th>Marcação</th><th>Estado</th><th>Consulta</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{fmt(r.receivedAt)}</td>
              <td>{r.triggerEvent}{r.duplicate && <span className="bo-muted"> (repetido)</span>}</td>
              <td className="bo-muted">{r.uid ?? ""}</td>
              <td>{r.status ?? ""}</td>
              <td>{r.startTime ? fmt(r.startTime) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Reminders() {
  const rows = await reminderLog();
  return (
    <>
      <p className="bo-muted bo-small">
        Modo atual: <strong>{reminderMode() === "simulacao" ? "simulação (nada é enviado)" : "WhatsApp"}</strong>
      </p>
      {!rows.length ? (
        <p className="bo-empty">Sem lembretes registados.</p>
      ) : (
        <div className="bo-table-wrap">
          <table className="bo-table">
            <thead>
              <tr><th>Quando</th><th>Consulta</th><th>Telefone</th><th>Resultado</th><th>Mensagem</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{fmt(r.at)}</td>
                  <td>{fmt(r.start)}</td>
                  <td>{r.telefone}</td>
                  <td>{r.ok ? (r.mode === "simulacao" ? "simulado" : "enviado") : <span className="bo-error">{r.error}</span>}</td>
                  <td className="bo-small">{r.texto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default async function LogsPage({ searchParams }: PageProps<"/backoffice/registos">) {
  await verifySession();
  const requested = (await searchParams).ver;
  const tab: Tab = typeof requested === "string" && requested in TABS ? (requested as Tab) : "auditoria";
  return (
    <>
      <h1>Registos</h1>
      <nav className="bo-tabs">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link key={t} href={`/backoffice/registos?ver=${t}`} aria-current={t === tab ? "page" : undefined}>
            {TABS[t]}
          </Link>
        ))}
      </nav>
      {tab === "auditoria" ? <Audit /> : tab === "webhooks" ? <Webhooks /> : <Reminders />}
    </>
  );
}
