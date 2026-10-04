import type { Metadata } from "next";
import { connection } from "next/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsappFloat from "@/components/WhatsappFloat";
import { getConfig } from "@/lib/booking/store";
import BookingWizard from "./BookingWizard";

export const metadata: Metadata = {
  title: "Marcar Consulta · Filipa Rebelo Nutricionista",
  description: "Escolhe o local, o dia e a hora da tua consulta de nutrição, presencial ou online.",
};

export default async function MarcarConsultaPage() {
  await connection();
  const config = await getConfig();
  const locations = config.locations.filter((l) => l.active);

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
            Seleciona o local, presencial ou online, e um horário disponível. Recebo o teu pedido e
            confirmo a marcação contigo.
          </p>
          <BookingWizard locations={locations} />
        </div>
      </section>
      <Footer />
      <WhatsappFloat />
    </>
  );
}
