import React from 'react';
import { Link } from 'react-router-dom';
import { FaBell, FaBolt, FaLeaf, FaMapMarkerAlt, FaShieldAlt, FaUsers } from 'react-icons/fa';
import './LandingPage.css';

const stats = [
  { label: 'Denúncias solucionadas', value: '+2.4k' },
  { label: 'Cidades ativas', value: '98' },
  { label: 'Tempo médio de resposta', value: '3h' },
];

const highlights = [
  {
    icon: <FaMapMarkerAlt />,
    title: 'Mapa vivo',
    text: 'Pontos críticos destacados em cores e agrupados em tempo real.',
  },
  {
    icon: <FaBell />,
    title: 'Alertas imediatos',
    text: 'Receba retorno da prefeitura e acompanhe a solução.',
  },
  {
    icon: <FaShieldAlt />,
    title: 'Dados confiáveis',
    text: 'Validação comunitária para evitar falsos positivos.',
  },
];

const LandingPage = () => {
  return (
    <div className="landing-container" role="banner">
      <div className="landing-gradient" aria-hidden="true" />
      <div className="landing-noise" aria-hidden="true" />

      <div className="landing-grid">
        <div className="hero-card">
          <div className="eyebrow">
            <span className="pulse-dot" aria-hidden="true" />
            Nova geração de monitoramento urbano
          </div>
          <h1>
            Olho Verde, um mapa vivo para cidades mais <span className="accent">inteligentes</span>.
          </h1>
          <p className="lead">
            Denuncie, acompanhe e resolva focos de risco com uma interface pensada para agilidade e
            transparência entre cidadãos e gestão pública.
          </p>

          <div className="hero-actions">
            <Link to="/login" className="landing-button primary">
              Entrar agora
            </Link>
            <Link to="/register" className="landing-button secondary">
              Criar conta
            </Link>
          </div>

          <div className="stat-row" aria-label="Números rápidos do Olho Verde">
            {stats.map((item) => (
              <div key={item.label} className="stat-pill">
                <span className="stat-value">{item.value}</span>
                <span className="stat-label">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flow-row">
            <div className="flow-step">
              <span className="flow-number">1</span>
              <div>
                <p className="flow-title">Clique no mapa</p>
                <p className="flow-text">Escolha o ponto exato e descreva o problema.</p>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-number">2</span>
              <div>
                <p className="flow-title">Anexe evidências</p>
                <p className="flow-text">Fotos, vídeos curtos e comentários da comunidade.</p>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-number">3</span>
              <div>
                <p className="flow-title">Receba retorno</p>
                <p className="flow-text">Alertas automáticos a cada atualização de status.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="side-column">
          <div className="glass-card live-card">
            <div className="live-header">
              <div className="live-title">
                <FaLeaf className="live-icon" />
                Painel imediato
              </div>
              <span className="live-status">
                <span className="live-dot" aria-hidden="true" />
                Atualizado agora
              </span>
            </div>
            <div className="live-grid">
              <div className="live-box">
                <FaBolt />
                <div>
                  <p className="live-label">Prioridade</p>
                  <p className="live-value">Alto</p>
                  <small>Bueiro entupido • Centro</small>
                </div>
              </div>
              <div className="live-box">
                <FaUsers />
                <div>
                  <p className="live-label">Engajamento</p>
                  <p className="live-value">+187</p>
                  <small>Votos e comentários recentes</small>
                </div>
              </div>
              <div className="live-box span-2">
                <FaBell />
                <div>
                  <p className="live-label">Alertas em monitoramento</p>
                  <p className="live-value">12</p>
                  <small>Inclui 3 em resolução pela prefeitura</small>
                </div>
              </div>
            </div>
            <div className="progress-track">
              <span>Fluxo de solução</span>
              <div className="progress-bar">
                <span className="progress-fill" />
              </div>
              <div className="progress-tags">
                <span>Aberta</span>
                <span>Em análise</span>
                <span>Resolvida</span>
              </div>
            </div>
          </div>

          <div className="glass-card highlight-card">
            <p className="highlight-eyebrow">Por que usar?</p>
            <h3>Sinais claros e foco no que importa</h3>
            <div className="highlight-list">
              {highlights.map((item) => (
                <div key={item.title} className="highlight-item">
                  <span className="highlight-icon">{item.icon}</span>
                  <div>
                    <p className="highlight-title">{item.title}</p>
                    <p className="highlight-text">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
