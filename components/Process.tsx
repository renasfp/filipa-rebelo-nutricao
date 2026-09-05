import Reveal from "./Reveal";

const STEPS = [
  {
    title: "Marcas a consulta",
    text: "Escolhes o serviço, a data e preferes presencial (Viseu ou Seia) ou online.",
  },
  {
    title: "Primeira consulta",
    text: "Falamos sobre os teus hábitos, objetivos, rotina e historial de saúde.",
  },
  {
    title: "Recebes o teu plano",
    text: "Um plano personalizado e ementas adaptadas à sua vida real.",
  },
  {
    title: "Acompanhamento",
    text: "Apoio contínuo por WhatsApp e consultas de seguimento ao teu ritmo.",
  },
];

export default function Process() {
  return (
    <section className="section" id="process">
      <div className="container">
        <div style={{ textAlign: "center", maxWidth: 500, margin: "0 auto 0" }}>
          <div className="section-label" style={{ justifyContent: "center" }}>
            Como funciona
          </div>
          <h2 className="section-title">
            Do primeiro passo à <em>mudança real</em>
          </h2>
        </div>
        <div className="process-steps">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} className="step">
              <div className="step-number">{i + 1}</div>
              <h4>{step.title}</h4>
              <p>{step.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
