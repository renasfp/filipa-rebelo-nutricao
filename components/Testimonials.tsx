import Reveal from "./Reveal";

const TESTIMONIALS = [
  {
    quote:
      "A Filipa mudou completamente a minha relação com a comida. Sem restrições absurdas, com muita paciência e explicações que fazem sentido.",
    author: "Ana S., Viseu",
  },
  {
    quote:
      "Trabalho por turnos há 10 anos e nunca tinha conseguido manter uma alimentação equilibrada. Com o plano da Filipa finalmente consigo.",
    author: "Ricardo M., Seia",
  },
  {
    quote:
      "O apoio pelo WhatsApp é um luxo. Tenho sempre alguém a quem recorrer quando tenho dúvidas ou quando estou a ceder a tentações!",
    author: "Marta F., Online",
  },
];

export default function Testimonials() {
  return (
    <section className="section" id="testimonials">
      <div className="container">
        <Reveal className="testimonials-intro">
          <div className="section-label">Testemunhos</div>
          <h2 className="section-title">
            O que dizem as <em>minhas clientes</em>
          </h2>
        </Reveal>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((testimonial) => (
            <Reveal key={testimonial.author} className="testimonial-card">
              <div className="stars">★★★★★</div>
              <blockquote>&quot;{testimonial.quote}&quot;</blockquote>
              <div className="testimonial-author">— {testimonial.author}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
