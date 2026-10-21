import { verifySession } from "@/lib/backoffice/session";
import { listPrices } from "@/lib/payments";
import PriceForm from "./PriceForm";

export default async function PricesPage() {
  await verifySession();
  let rows: Awaited<ReturnType<typeof listPrices>> = [];
  let error = false;
  try {
    rows = await listPrices();
  } catch (err) {
    console.error("[backoffice/precos]", err);
    error = true;
  }
  return (
    <>
      <h1>Preços</h1>
      <p className="bo-muted">
        Preço de cada tipo de consulta do Cal.com. Com preço, a marcação pelo site pede pagamento (MB WAY ou Multibanco)
        e só fica confirmada depois de paga. Sem preço, fica pendente para confirmares à mão.
      </p>
      {error && <p className="bo-error">Não foi possível ler os tipos de consulta do Cal.com.</p>}
      {rows.map((r) => (
        <article key={r.slug} className="bo-card">
          <strong>{r.title}</strong> <span className="bo-muted bo-small">{r.lengthInMinutes} min</span>
          <div style={{ marginTop: "0.5rem" }}>
            <PriceForm slug={r.slug} current={r.amountCents} />
          </div>
        </article>
      ))}
    </>
  );
}
