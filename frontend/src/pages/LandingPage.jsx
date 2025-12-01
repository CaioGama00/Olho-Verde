import React from "react";
import { Link } from "react-router-dom";
import planetIcon from "../assets/planet.png";
import "./LandingPage.css";

const instructions = [
  {
    number: "1",
    title: "Clique no mapa",
    text: "Escolha o ponto exato e descreva o problema.",
  },
  {
    number: "2",
    title: "Anexe evidências",
    text: "Fotos e comentários da comunidade.",
  },
  {
    number: "3",
    title: "Receba retorno",
    text: "Alertas automáticos a cada atualização de status.",
  },
];

const LandingPage = () => {
  return (
    <div className="landing-container" role="banner">
      <div className="landing-noise" aria-hidden="true" />

      <div className="landing-content">
        <div className="hero-section">
          <div className="planet-wrapper">
            <img
              src={planetIcon}
              alt="Planeta Olho Verde"
              className="planet-icon"
            />
            <div className="planet-overlay" />
          </div>
          <h1 className="main-title">Olho Verde</h1>
          <p className="subtitle">
            Denuncie, acompanhe e resolva focos de risco com uma interface
            pensada para agilidade e transparência entre cidadãos e gestão
            pública.
          </p>

          <div className="action-buttons">
            <Link to="/login" className="landing-button primary">
              Entrar
            </Link>
            <Link to="/register" className="landing-button secondary">
              Cadastro
            </Link>
          </div>
        </div>

        <div className="instructions-section">
          <h2 className="instructions-title">Como funciona?</h2>
          <div className="instructions-grid">
            {instructions.map((item) => (
              <div key={item.number} className="instruction-card">
                <div className="instruction-number">{item.number}</div>
                <h3 className="instruction-title">{item.title}</h3>
                <p className="instruction-text">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
