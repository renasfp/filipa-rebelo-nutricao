import type { Metadata } from "next";
import { connection } from "next/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsappFloat from "@/components/WhatsappFloat";
import { getLocations } from "@/lib/booking/availability";
import type { Location } from "@/lib/booking/types";
import BookingWizard from "./BookingWizard";

export const metadata: Metadata = {
  title: "Marcar Consulta · Filipa Rebelo Nutricionista",
  description: "Escolhe o local, o dia e a hora da tua consulta de nutrição, presencial ou online.",
};

export default async function MarcarConsultaPage() {
  await connection();
  let locations: Location[] = [];
  try {
    locations = await getLocations();
  } catch (err) {
    console.error("[marcar-consulta]", err);
  }

  return (
    <>
      <Navbar />
      <section className="section booking-page">
        <div className="container booking-container">
          <div className="section-label">Marcar consulta</div>
          <h2 className="section-title">
            Escolhe o <em>dia e a hora</em>
          </h2>
          <p className="section-sub">
            Seleciona o tipo de consulta e um horário disponível. Recebo o teu pedido e confirmo a
            marcação contigo.
          </p>
          {locations.length ? (
            <BookingWizard locations={locations} />
          ) : (
            <p className="booking-muted">
              De momento não é possível marcar online. Contacta-me por WhatsApp, por favor.
            </p>
          )}
        </div>
      </section>
      <Footer />
      <WhatsappFloat />
    </>
  );
}
