import Reveal from "./Reveal";
import TestimonialQuote from "./TestimonialQuote";

// Avaliações copiadas do perfil no Google (texto original, sem alterações).
const GOOGLE_REVIEWS_URL = "https://www.google.com/maps?cid=8661954669768325671";
const GOOGLE_RATING = "5,0";
const GOOGLE_REVIEW_COUNT = 14;

const TESTIMONIALS = [
  {
    quote: `Gosto verdadeiramente de comer e de desfrutar bons momentos à mesa, por isso encontrar um acompanhamento nutricional que fizesse sentido para mim era essencial. Aos 43 anos, e desde 2020, a Dr.ª Filipa tem sido uma profissional excecional, que me faz sentir sempre segura e capaz de alcançar os meus objetivos.
Perdi mais de 15 kg com novas práticas e hábitos alimentares, mas a maior transformação foi interna: ganhei autoconfiança, autocontrolo e um bem-estar físico e psicológico que já não imaginava possível. As consultas transformam os meus pensamentos e, mesmo quando os resultados não são exatamente os desejados, a Dr.ª Filipa sabe sempre encontrar algo digno de celebração. Esse reconhecimento dá-me força para não desistir e orgulho no caminho que estamos a construir juntas.
Aprendi a ouvir o meu corpo e a adaptar-me às diferentes fases da vida. Hoje estou bem, estou feliz, e reconheço na Dr.ª Filipa não só uma nutricionista, mas também uma verdadeira terapeuta. Depois de muitas tentativas falhadas, finalmente encontrei o método que funciona para mim. Foi, sem dúvida, uma das melhores decisões dos últimos anos.`,
    author: "Ana Paiva",
  },
  {
    quote: `Desde o início de junho que tenho o privilégio de ser acompanhada pela Dra. Filipa e, ao fim de quase três meses, posso dizer que tem sido um percurso verdadeiramente transformador. ❤️

Mais do que uma excelente nutricionista, a Dra. Filipa é uma pessoa que sabe ouvir, compreender e, sobretudo, motivar. Em cada consulta sinto que não estou apenas a falar de alimentação ou de números na balança. Há sempre uma palavra certa, um incentivo e uma forma diferente de olhar para o caminho que estou a percorrer.

Tem-me ajudado a mudar hábitos de uma forma realista e sustentável, sem extremismos nem dietas impossíveis de manter. E, talvez mais importante, tem-me ajudado a mudar a minha relação com a alimentação e comigo própria.

É essa capacidade de nos fazer acreditar que conseguimos, mesmo nos dias menos bons, que para mim faz toda a diferença. É nutricionista, mas é também uma verdadeira coach neste processo de mudança. ✨

Estou muito grata por ter encontrado a Dra. Filipa e por estar a construir este caminho com ela. Ainda falta percurso, mas hoje sinto-me muito mais motivada, confiante e consciente das minhas escolhas.

Recomendo-a de coração a quem procura não apenas uma nutricionista, mas alguém que realmente nos acompanha, nos incentiva e acredita em nós. ❤️`,
    author: "Susana Azevedo",
  },
  {
    quote:
      "Sou muito agradecido à Dra. Filipa. Ao longo deste percurso, senti um cuidado genuíno com o meu bem-estar. Graças ao acompanhamento constante, consegui atingir os meus objetivos de forma saudável. Profissional, atenciosa e motivadora, recomendo muito para todos os que tiverem a pensar em contratar uma nutricionista.",
    author: "Mauro Almeida",
  },
];

export default function Testimonials() {
  return (
    <section className="section" id="testimonials">
      <div className="container">
        <Reveal className="testimonials-intro">
          <div className="section-label">Testemunhos</div>
          <h2 className="section-title">
            O que dizem <em>sobre o acompanhamento</em>
          </h2>
        </Reveal>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((testimonial) => (
            <Reveal key={testimonial.author} className="testimonial-card">
              <div className="stars">★★★★★</div>
              <TestimonialQuote text={testimonial.quote} />
              <div className="testimonial-author">— {testimonial.author}</div>
            </Reveal>
          ))}
        </div>
        <Reveal className="testimonials-google">
          <span>
            <strong>{GOOGLE_RATING} ★</strong> · {GOOGLE_REVIEW_COUNT} avaliações no Google
          </span>
          <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" className="btn-outline">
            Ver todas as avaliações
          </a>
        </Reveal>
      </div>
    </section>
  );
}
