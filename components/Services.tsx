import Reveal from "./Reveal";

const SERVICES = [
  {
    title: "Consulta de Nutrição",
    text: "Avaliação completa do teu estado nutricional, hábitos alimentares e objetivos. Presencial em Viseu ou Seia, ou online.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A7560" strokeWidth="1.8">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    title: "Plano Alimentar Personalizado",
    text: "Um plano construído à sua medida — adaptado às suas preferências, rotina, objetivos e condição de saúde.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A7560" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    title: "Reeducação Alimentar",
    text: "Um processo gradual para mudar a sua relação com a comida de forma duradoura, sem dietas restritivas ou regras rígidas.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A7560" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: "Apoio pelo WhatsApp",
    text: "Acompanhamento entre consultas para tirar dúvidas, partilhar refeições e manter a motivação no dia a dia.",
    highlight: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .91h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
      </svg>
    ),
  },
  {
    title: "Ementas Semanais",
    text: "Ementas práticas e variadas para toda a família ou para ti, com sugestões de compras e preparação rápida.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A7560" strokeWidth="1.8">
        <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" />
      </svg>
    ),
  },
  {
    title: "Nutrição para Turnos",
    text: "Planeamento alimentar específico para profissionais com horários rotativos — respeitar o teu ciclo é fundamental para o teu bem-estar.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A7560" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

export default function Services() {
  return (
    <section className="section" id="services">
      <div className="container">
        <div className="services-intro">
          <div>
            <div className="section-label">Serviços</div>
            <h2 className="section-title">
              Como te posso
              <br />
              <em>acompanhar</em>
            </h2>
          </div>
        </div>
        <div className="services-grid">
          {SERVICES.map((service) => (
            <Reveal
              key={service.title}
              className={`service-card${service.highlight ? " highlight" : ""}`}
            >
              <div className="service-icon">{service.icon}</div>
              <h3>{service.title}</h3>
              <p>{service.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
