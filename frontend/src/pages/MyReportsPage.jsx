// MyReportsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import reportService from '../services/reportService';
import { getStatusLabel, REPORT_STATUS_OPTIONS } from '../utils/reportStatus';
import './MyReportsPage.css'; // Importe o CSS

const MyReportsPage = ({ currentUser }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addressMap, setAddressMap] = useState({});
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const navigate = useNavigate();
  const fallbackAddress = 'Endereço aproximado indisponível';

  const getAddress = async (lat, lng) => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (addressMap[key]) return addressMap[key];
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'Olho-Verde' },
      });
      const data = await res.json();
      const label =
        data?.address?.road ||
        data?.address?.pedestrian ||
        data?.address?.suburb ||
        data?.display_name ||
        '';
      const formatted = label ? label : fallbackAddress;
      setAddressMap((prev) => ({ ...prev, [key]: formatted }));
      return formatted;
    } catch {
      return fallbackAddress;
    }
  };

  const fetchAddresses = (items) => {
    const toFetch = items.filter(
      (r) => r.position && typeof r.position.lat === 'number' && typeof r.position.lng === 'number'
    );
    toFetch.forEach((r) => getAddress(r.position.lat, r.position.lng));
  };

  const normalizeDate = (value) => (value ? new Date(value).setHours(0, 0, 0, 0) : null);

  const isWithinDateRange = (dateValue, start, end) => {
    if (!dateValue) return true;
    const date = new Date(dateValue).setHours(0, 0, 0, 0);
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  };

  const buildAddressKey = (position) => {
    if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') return null;
    return `${position.lat.toFixed(5)},${position.lng.toFixed(5)}`;
  };

  const getLocationLabel = (report) => {
    const key = buildAddressKey(report.position);
    if (!key) return '—';

    const cachedAddress = addressMap[key];
    if (cachedAddress) return cachedAddress;

    return `${report.position.lat.toFixed(4)}, ${report.position.lng.toFixed(4)}`;
  };

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
        fetchAddresses(myReports);
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
          fetchAddresses(myReports);
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

  const handleClearFilters = () =>
    setFilters({
      status: '',
      search: '',
      startDate: '',
      endDate: '',
    });

  const filteredReports = reports.filter((report) => {
    const statusMatch = !filters.status || report.status === filters.status;
    const searchText = filters.search.trim().toLowerCase();
    const key = buildAddressKey(report.position);
    const addressLabel = key ? (addressMap[key] || '') : '';
    const searchMatch =
      !searchText ||
      (report.problem || '').toLowerCase().includes(searchText) ||
      (addressLabel || '').toLowerCase().includes(searchText) ||
      String(report.id || '').includes(searchText);

    const start = normalizeDate(filters.startDate);
    const end = normalizeDate(filters.endDate);
    const dateMatch = isWithinDateRange(report.created_at, start, end);

    return statusMatch && searchMatch && dateMatch;
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });

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

      <div className="filters-row my-reports-filters">
        <div className="filter-field">
          <label>Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="">Todos</option>
            {REPORT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label>Problema / Endereço / ID</label>
          <input
            type="text"
            placeholder="Buscar texto"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <div className="filter-field">
          <label>Data inicial</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
          />
        </div>
        <div className="filter-field">
          <label>Data final</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
        <button
          className="clear-button"
          type="button"
          onClick={handleClearFilters}
        >
          Limpar
        </button>
      </div>

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
      ) : sortedReports.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma denúncia encontrada com os filtros atuais.</p>
          <button className="clear-button" onClick={handleClearFilters}>
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="my-reports-grid">
          {sortedReports.map(report => (
            <div
              key={report.id}
              className="report-card"
              onClick={() => navigate(`/?reportId=${report.id}`)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  navigate(`/?reportId=${report.id}`);
                }
              }}
            >
              <div className="report-card-header">
                <h3>{report.problem}</h3>
                <span className={`report-status status-${report.status || 'indefinido'}`}>
                  {getStatusLabel ? getStatusLabel(report.status) : report.status || 'Indefinido'}
                </span>
              </div>

              <div className="report-details">
                <div className="report-detail-item">
                  <strong>Localização aproximada</strong>
                  <span>
                    {getLocationLabel(report)}
                  </span>
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
