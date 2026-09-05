export default function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-brand">
          <a href="#" className="nav-logo">
            Filipa Rebelo <span>Nutricionista</span>
          </a>
          <p>
            Acompanhamento nutricional personalizado em Viseu, Seia e online. Porque a
            alimentação certa é aquela que funciona para a sua vida.
          </p>
        </div>
        <div>
          <h5>Navegação</h5>
          <ul className="footer-links">
            <li>
              <a href="#about">Sobre mim</a>
            </li>
            <li>
              <a href="#services">Serviços</a>
            </li>
            <li>
              <a href="#process">Como funciona</a>
            </li>
            <li>
              <a
                href="https://nutrium.com/p/filiparebelo4499/schedule"
                target="_blank"
                rel="noreferrer"
              >
                Marcar consulta
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h5>Contacto</h5>
          <ul className="footer-links">
            <li>
              <a href="https://wa.me/message/FV7FQDPR5EV2M1" target="_blank" rel="noreferrer">
                WhatsApp · 963 320 311
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/filiparebelo_nutricionista"
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
            </li>
            <li>
              <a href="mailto:filipa.rebelo@live.com.pt">filipa.rebelo@live.com.pt</a>
            </li>
            <li>
              <a href="#">Viseu · Seia · Online</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2025 Filipa Rebelo Nutricionista</span>
        <span>Política de Privacidade</span>
      </div>
    </footer>
  );
}
