import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Sobre from './components/Sobre';
import Servicos from './components/Servicos';
import Processo from './components/Processo';
import Testemunhos from './components/Testemunhos';
import Contacto from './components/Contacto';
import Footer from './components/Footer';

function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <Sobre />
      <Servicos />
      <Processo />
      <Testemunhos />
      <Contacto />
      <Footer />
    </>
  );
}

export default App;
