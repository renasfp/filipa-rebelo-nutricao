import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { formatDateLong } from "@/lib/booking/time";
import { paymentPageState, portuguesePhone } from "@/lib/payments";
import PaymentPanel from "./PaymentPanel";

export const metadata: Metadata = {
  title: "Pagamento · Filipa Rebelo Nutricionista",
  robots: { index: false, follow: false },
};

const euros = (cents: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);

export default async function PaymentPage({ params }: PageProps<"/marcar-consulta/pagamento/[uid]">) {
  const { uid } = await params;
  const state = await paymentPageState(uid);
  if (!state) notFound();
  const { booking } = state;
  const start = new Date(booking.start);
  const date = start.toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
  const hour = start.toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" });
  const last = state.payments[0];
  const attendee = booking.attendees[0];

  return (
    <>
      <Navbar />
      <section className="section booking-page">
        <div className="container booking-container">
          <div className="section-label">Pagamento</div>
          <h2 className="section-title">
            Confirma a tua <em>consulta</em>
          </h2>
          <div className="booking-summary">
            <strong>{booking.title.split(" entre ")[0].split(" between ")[0]}</strong> · {formatDateLong(date)} às {hour}
            {state.amountCents !== null && <> · {euros(state.amountCents)}</>}
          </div>
          {state.amountCents === null ? (
            <p className="booking-muted">O preço desta consulta ainda não está definido. Vamos contactar-te para confirmar.</p>
          ) : (
            <PaymentPanel
              uid={uid}
              amount={euros(state.amountCents)}
              bookingStatus={booking.status}
              paid={state.paid}
              open={
                state.open && {
                  method: state.open.method,
                  expiresAt: state.open.expiresAt.toISOString(),
                  entity: state.open.entity,
                  reference: state.open.reference,
                  phoneHint: state.open.phoneHint,
                }
              }
              lastFailed={last && last.status !== "pago" && last !== state.open ? last.method : null}
              canMultibanco={state.canMultibanco}
              holdUntil={state.holdUntil.toISOString()}
              defaultPhone={portuguesePhone(attendee?.phoneNumber ?? "") ?? ""}
            />
          )}
        </div>
      </section>
      <Footer />
    </>
  );
}
