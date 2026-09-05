import Reveal from "./Reveal";

const PILLS = [
  "Nutrição Clínica",
  "Reeducação Alimentar",
  "Trabalhadores por Turnos",
  "Planos Personalizados",
  "Consulta Online",
];

export default function About() {
  return (
    <section className="section" id="about">
      <div className="container">
        <div className="about-grid">
          <Reveal className="about-visual">
            <div
              className="about-image-frame"
              style={{ backgroundImage: "url('/images/quem-sou.jpg')" }}
            />
            <div className="about-badge">
              <strong>+12</strong>
              <span>
                anos de
                <br />
                experiência
              </span>
            </div>
          </Reveal>
          <Reveal className="about-content">
            <div className="section-label">Sobre mim</div>
            <h2 className="section-title">
              Olá, sou a <em>Filipa Rebelo</em>
            </h2>
            <p>
              Sou nutricionista (C.P. 2767N) com mais de 12 anos de experiência, com consultas
              presenciais em Viseu e Seia, e também online. Acredito que uma alimentação
              saudável não tem de ser complicada — tem de ser real, adaptada à sua vida e
              sustentável a longo prazo.
            </p>
            <p>
              O meu trabalho não passa por dar listas de alimentos proibidos. Passa por te
              ajudar a perceber o teu corpo, os teus hábitos e construir uma relação positiva
              com a comida — seja qual for o teu ponto de partida.
            </p>
            <p>
              Tenho especial interesse em nutrição para pessoas que trabalham por turnos, uma
              área onde pequenas mudanças fazem uma diferença enorme no bem-estar e na
              qualidade de vida diária.
            </p>
            <div className="about-pills">
              {PILLS.map((pill) => (
                <span key={pill} className="pill">
                  {pill}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
