// MyReportsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import reportService from '../services/reportService';
import { getStatusLabel } from '../utils/reportStatus';
import './MyReportsPage.css'; // Importe o CSS

const MyReportsPage = ({ currentUser }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyReports = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await reportService.getMyReports();
        const allReports = response?.data || [];
        const myId = currentUser?.user?.id || currentUser?.id;
        // filter safely; if no reports exist, set empty array (no error)
        const myReports = allReports.filter((r) => String(r.user_id) === String(myId));
        setReports(myReports);
      } catch (error) {
        console.error("Erro ao buscar meus reports:", error);
        setError("Erro ao carregar suas denúncias. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchMyReports();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const handleRefresh = () => {
    if (currentUser) {
      const fetchMyReports = async () => {
        try {
          setLoading(true);
          setError(null);
          const response = await reportService.getMyReports();
          const allReports = response?.data || [];
          const myId = currentUser?.user?.id || currentUser?.id;
          const myReports = allReports.filter((r) => String(r.user_id) === String(myId));
          setReports(myReports);
        } catch (error) {
          console.error("Erro ao buscar meus reports:", error);
          setError("Erro ao carregar suas denúncias. Tente novamente.");
        } finally {
          setLoading(false);
        }
      };
      fetchMyReports();
    }
  };

  if (!currentUser) {
    return (
      <div className="my-reports-page">
        <div className="empty-state">
          <h1>Minhas Denúncias</h1>
          <p>Você precisa estar logado para ver suas denúncias.</p>
          <button className="refresh-button" onClick={() => navigate('/login')}>
            Fazer Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-reports-page">
      <header>
        <div>
          <p className="subtitle">Painel do Usuário</p>
          <h1>Minhas Denúncias</h1>
        </div>
        <button className="refresh-button" onClick={handleRefresh}>
          Atualizar
        </button>
      </header>

      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <p>Carregando suas denúncias...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <p>Você não fez nenhuma denúncia ainda.</p>
          <button className="refresh-button" onClick={() => navigate('/')}>
            Fazer Primeira Denúncia
          </button>
        </div>
      ) : (
        <div className="my-reports-grid">
          {reports.map(report => (
            <div key={report.id} className="report-card">
              <div className="report-card-header">
                <h3>{report.problem}</h3>
                {
                  // Determine effective status: remove "nova" if report is older than 1 day
                  (() => {
                    const createdAt = report.created_at ? new Date(report.created_at) : null;
                    const isOlderThan1Day = createdAt ? (Date.now() - createdAt.getTime()) > 24 * 60 * 60 * 1000 : false;
                    const effectiveStatus = report.status === 'nova' && isOlderThan1Day ? null : report.status;
                    const cssStatus = effectiveStatus || 'indefinido';
                    return (
                      <span className={`report-status status-${cssStatus}`}>
                        {getStatusLabel ? getStatusLabel(effectiveStatus) : effectiveStatus}
                      </span>
                    );
                  })()
                }
              </div>
              
              <div className="report-details">
                <div className="report-detail-item">
                  <strong>Localização</strong>
                  <span>{report.position?.lat?.toFixed(4)}, {report.position?.lng?.toFixed(4)}</span>
                </div>
                <div className="report-detail-item">
                  <strong>Data</strong>
                  <span>{new Date(report.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="report-detail-item">
                  <strong>ID</strong>
                  <span>#{report.id}</span>
                </div>
              </div>

              <div className="report-votes">
                <div className="vote-item positive">
                  <span>👍</span>
                  <span>{report.upvotes || 0} positivos</span>
                </div>
                <div className="vote-item negative">
                  <span>👎</span>
                  <span>{report.downvotes || 0} negativos</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyReportsPage;