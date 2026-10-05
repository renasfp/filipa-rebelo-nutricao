import Link from "next/link";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-text">
        <div className="hero-eyebrow">Nutricionista C.P. 2767N · Viseu & Seia</div>
        <h1>
          O cuidado nutricional <br/> 
          <em> que cabe na sua vida</em>
        </h1>
        <p className="hero-sub">
          Acompanhamento nutricional personalizado que se adapta ao seu ritmo, rotina e
          objetivos — sem regras rígidas nem soluções genéricas.
        </p>
        <div className="hero-actions">
          <Link href="/marcar-consulta" className="btn-primary">
            Marcar Consulta
          </Link>
          <a href="#services" className="btn-outline">
            Ver Serviços
          </a>
        </div>
        <div className="hero-locations">
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Viseu
          </span>
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Seia
          </span>
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            Consulta Online
          </span>
        </div>
      </div>
      <div className="hero-visual">
        <div className="hero-visual-bg" />
        <div className="hero-visual-pattern" />
        <div className="hero-photo-wrap" style={{ backgroundImage: "url('/images/filipa.jpg')" }} />
        <div className="hero-card">
          <div className="hero-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A7560" strokeWidth="1.8">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <div className="hero-card-text">
            <p>Acompanhamento contínuo</p>
            <strong>Apoio pelo WhatsApp incluído</strong>
          </div>
        </div>
      </div>
    </section >
  );
}
