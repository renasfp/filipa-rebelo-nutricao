import { verifySession } from "@/lib/backoffice/session";
import { recentPayments } from "@/lib/payments";

const STATUS: Record<string, string> = {
  pendente: "bo-chip-media",
  pago: "bo-chip-ok",
  expirado: "",
  cancelado: "",
  erro: "bo-chip-alta",
  reembolsado: "bo-chip-info",
};
const fmt = (d: Date) =>
  d.toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" });
const euros = (cents: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);

export default async function PaymentsPage() {
  await verifySession();
  const rows = await recentPayments();
  return (
    <>
      <h1>Pagamentos</h1>
      <p className="bo-muted">Pedidos de pagamento feitos pelo site (EuPago), do mais recente para o mais antigo.</p>
      {!rows.length ? (
        <p className="bo-empty">Ainda não há pagamentos.</p>
      ) : (
        <div className="bo-table-wrap">
          <table className="bo-table">
            <thead>
              <tr><th>Criado</th><th>Método</th><th>Valor</th><th>Estado</th><th>Detalhe</th><th>Marcação</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{fmt(p.createdAt)}</td>
                  <td>{p.method === "mbway" ? "MB WAY" : "Multibanco"}</td>
                  <td>{euros(p.amountCents)}</td>
                  <td>
                    <span className={`bo-chip ${STATUS[p.status] ?? ""}`}>{p.status}</span>
                    {p.lateAfterRelease && <div className="bo-error bo-small">Pago depois de libertada — devolver ou remarcar</div>}
                  </td>
                  <td className="bo-small">
                    {p.method === "multibanco" ? `Ent. ${p.entity ?? "—"} · Ref. ${p.reference ?? "—"}` : `Telemóvel ${p.phoneHint ?? "—"}`}
                    <div className="bo-muted">
                      {p.paidAt ? `Pago ${fmt(p.paidAt)}` : `Expira ${fmt(p.expiresAt)}`}
                    </div>
                    <div className="bo-muted" title="Identificador na EuPago">ID {p.id}</div>
                  </td>
                  <td className="bo-muted bo-small">{p.bookingUid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
