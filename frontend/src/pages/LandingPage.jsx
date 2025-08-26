import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-container">
      <div className="landing-overlay">
        <div className="landing-content">
          <h1>Olho Verde</h1>
          <p>Sua plataforma para monitorar e reportar problemas urbanos em sua cidade.</p>
          <div className="landing-actions">
            <Link to="/login" className="landing-button primary">Entrar</Link>
            <Link to="/register" className="landing-button secondary">Cadastro</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
