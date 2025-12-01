import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../services/adminService';
import { REPORT_STATUS_OPTIONS, getStatusLabel } from '../utils/reportStatus';
import './AdminDashboard.css';

const AdminDashboard = ({ currentUser }) => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusLoadingMap, setStatusLoadingMap] = useState({});
  const [userActionMap, setUserActionMap] = useState({});
  const [previewReport, setPreviewReport] = useState(null);
  const [reportFilters, setReportFilters] = useState({
    status: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [userFilters, setUserFilters] = useState({
    status: '',
    search: '',
    startDate: '',
    endDate: '',
  });

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortData = (data, config) => {
    if (!config.key) return data;
    return [...data].sort((a, b) => {
      let valA = a[config.key];
      let valB = b[config.key];

      // Handle null/undefined
      if (valA == null) valA = '';
      if (valB == null) valB = '';

      // Case insensitive string comparison
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) {
        return config.direction === 'ascending' ? -1 : 1;
      }
      if (valA > valB) {
        return config.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  };

  const ensureAdminOrRedirect = useCallback(() => {
    if (!currentUser) {
      navigate('/login');
      return false;
    }

    if (!currentUser.isAdmin) {
      navigate('/');
      return false;
    }

    return true;
  }, [currentUser, navigate]);

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    setErrorMessage('');
    try {
      const response = await adminService.getReports();
      setReports(response.data);
    } catch (error) {
      console.error('Erro ao buscar denúncias:', error);
      setErrorMessage('Não foi possível carregar as denúncias. Tente novamente mais tarde.');
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setErrorMessage('');
    try {
      const response = await adminService.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      setErrorMessage('Não foi possível carregar os dados de usuários. Tente novamente mais tarde.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (ensureAdminOrRedirect()) {
      fetchReports();
      fetchUsers();
    }
  }, [ensureAdminOrRedirect, fetchReports, fetchUsers]);

  const updateReportStatus = async (reportId, status) => {
    setStatusLoadingMap((prev) => ({ ...prev, [reportId]: true }));
    setErrorMessage('');
    try {
      const response = await adminService.updateReportStatus(reportId, status);
      setReports((prev) =>
        prev.map((report) => (report.id === reportId ? response.data : report))
      );
    } catch (error) {
      console.error('Erro ao atualizar o status:', error);
      setErrorMessage('Não foi possível atualizar o status da denúncia.');
    } finally {
      setStatusLoadingMap((prev) => {
        const clone = { ...prev };
        delete clone[reportId];
        return clone;
      });
    }
  };

  const handleModerateReport = async (reportId, action) => {
    const reason = window.prompt(
      action === 'approve'
        ? 'Motivo da aprovação (opcional):'
        : 'Motivo da rejeição (obrigatório):'
    );

    if (action === 'reject' && !reason) {
      alert('É necessário informar um motivo para rejeitar.');
      return;
    }

    setStatusLoadingMap((prev) => ({ ...prev, [reportId]: true }));
    try {
      const response = await adminService.moderateReport(reportId, action, reason || 'Aprovado pelo admin');
      setReports((prev) =>
        prev.map((report) => (report.id === reportId ? response.data : report))
      );
      if (previewReport?.id === reportId) {
        setPreviewReport(response.data);
      }
    } catch (error) {
      console.error('Erro ao moderar:', error);
      alert('Erro ao moderar denúncia.');
    } finally {
      setStatusLoadingMap((prev) => {
        const clone = { ...prev };
        delete clone[reportId];
        return clone;
      });
    }
  };

  const handleUserBlockToggle = async (userId, shouldBlock) => {
    setUserActionMap((prev) => ({ ...prev, [userId]: true }));
    setErrorMessage('');
    try {
      const response = await adminService.toggleUserBlock(userId, shouldBlock);
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, banned_until: response.data.banned_until } : user
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      setErrorMessage('Não foi possível atualizar o status do usuário.');
    } finally {
      setUserActionMap((prev) => {
        const clone = { ...prev };
        delete clone[userId];
        return clone;
      });
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm('Tem certeza de que deseja remover este usuário?');
    if (!confirmed) return;

    setUserActionMap((prev) => ({ ...prev, [userId]: true }));
    setErrorMessage('');
    try {
      await adminService.deleteUser(userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      setErrorMessage('Não foi possível remover o usuário.');
    } finally {
      setUserActionMap((prev) => {
        const clone = { ...prev };
        delete clone[userId];
        return clone;
      });
    }
  };

  const normalizeDate = (value) => (value ? new Date(value).setHours(0, 0, 0, 0) : null);

  const isWithinDateRange = (dateValue, start, end) => {
    if (!dateValue) return true;
    const date = new Date(dateValue).setHours(0, 0, 0, 0);
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  };

  const filteredReports = reports.filter((report) => {
    const statusMatch = !reportFilters.status || report.status === reportFilters.status;
    const searchText = reportFilters.search.trim().toLowerCase();
    const searchMatch =
      !searchText ||
      (report.reporterName || '').toLowerCase().includes(searchText) ||
      (report.reporterEmail || '').toLowerCase().includes(searchText) ||
      (report.problem || '').toLowerCase().includes(searchText);

    const start = normalizeDate(reportFilters.startDate);
    const end = normalizeDate(reportFilters.endDate);
    const dateMatch = isWithinDateRange(report.created_at, start, end);

    return statusMatch && searchMatch && dateMatch;
  });

  const sortedReports = sortData(filteredReports, sortConfig);

  const filteredUsers = users.filter((user) => {
    const searchText = userFilters.search.trim().toLowerCase();
    const searchMatch =
      !searchText ||
      (user.name || '').toLowerCase().includes(searchText) ||
      (user.email || '').toLowerCase().includes(searchText);

    const isBlocked = Boolean(user.banned_until);
    const statusMatch =
      userFilters.status === ''
        ? true
        : userFilters.status === 'blocked'
          ? isBlocked
          : !isBlocked;

    const start = normalizeDate(userFilters.startDate);
    const end = normalizeDate(userFilters.endDate);
    const dateMatch = isWithinDateRange(user.created_at, start, end);

    return searchMatch && statusMatch && dateMatch;
  });

  const sortedUsers = sortData(filteredUsers, sortConfig);

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  const renderReportsTable = () => (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3>Painel de Denúncias</h3>
        <button onClick={fetchReports} className="refresh-button">
          Atualizar
        </button>
      </div>
      <div className="filters-row">
        <div className="filter-field">
          <label>Status</label>
          <select
            value={reportFilters.status}
            onChange={(e) => setReportFilters((prev) => ({ ...prev, status: e.target.value }))}
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
          <label>Usuário / Email / Problema</label>
          <input
            type="text"
            placeholder="Buscar texto"
            value={reportFilters.search}
            onChange={(e) => setReportFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <div className="filter-field">
          <label>Data inicial</label>
          <input
            type="date"
            value={reportFilters.startDate}
            onChange={(e) => setReportFilters((prev) => ({ ...prev, startDate: e.target.value }))}
          />
        </div>
        <div className="filter-field">
          <label>Data final</label>
          <input
            type="date"
            value={reportFilters.endDate}
            onChange={(e) => setReportFilters((prev) => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
        <button
          className="clear-button"
          type="button"
          onClick={() =>
            setReportFilters({
              status: '',
              search: '',
              startDate: '',
              endDate: '',
            })
          }
        >
          Limpar
        </button>
      </div>
      {loadingReports ? (
        <p>Carregando denúncias...</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th onClick={() => requestSort('id')} className="sortable-header">
                  # {getSortIndicator('id')}
                </th>
                <th onClick={() => requestSort('problem')} className="sortable-header">
                  Problema {getSortIndicator('problem')}
                </th>
                <th onClick={() => requestSort('reporterName')} className="sortable-header">
                  Usuário {getSortIndicator('reporterName')}
                </th>
                <th onClick={() => requestSort('reporterEmail')} className="sortable-header">
                  Email {getSortIndicator('reporterEmail')}
                </th>
                <th>
                  Visualizar
                </th>
                <th onClick={() => requestSort('status')} className="sortable-header">
                  Status {getSortIndicator('status')}
                </th>
                <th onClick={() => requestSort('moderation_status')} className="sortable-header">
                  Moderação {getSortIndicator('moderation_status')}
                </th>
                <th onClick={() => requestSort('created_at')} className="sortable-header">
                  Criada em {getSortIndicator('created_at')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">
                    Nenhuma denúncia encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                sortedReports.map((report, index) => (
                  <tr key={report.id}>
                    <td>{report.id}</td>
                    <td>{report.problem}</td>
                    <td>{report.reporterName || '—'}</td>
                    <td>{report.reporterEmail || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="preview-btn"
                        onClick={() => setPreviewReport(report)}
                        title="Visualizar denúncia"
                      >
                        Ver
                      </button>
                    </td>
                    <td>
                      <select
                        className={`status-select status-${report.status || 'default'}`}
                        value={report.status}
                        onChange={(event) => updateReportStatus(report.id, event.target.value)}
                        disabled={Boolean(statusLoadingMap[report.id])}
                      >
                        {REPORT_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="moderation-cell">
                        <span className={`status-pill ${report.moderation_status || 'pendente'}`}>
                          {report.moderation_status || 'pendente'}
                        </span>
                        {report.moderation_status !== 'aprovado' && (
                          <button
                            className="action-btn approve-btn"
                            onClick={() => handleModerateReport(report.id, 'approve')}
                            disabled={Boolean(statusLoadingMap[report.id])}
                            title="Aprovar"
                          >
                            ✓
                          </button>
                        )}
                        {report.moderation_status !== 'rejeitado' && (
                          <button
                            className="action-btn reject-btn"
                            onClick={() => handleModerateReport(report.id, 'reject')}
                            disabled={Boolean(statusLoadingMap[report.id])}
                            title="Rejeitar"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      {new Date(report.created_at).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderUsersTable = () => (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3>Gestão de Usuários</h3>
        <button onClick={fetchUsers} className="refresh-button">
          Atualizar
        </button>
      </div>
      <div className="filters-row">
        <div className="filter-field">
          <label>Status</label>
          <select
            value={userFilters.status}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="active">Ativo</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>
        <div className="filter-field">
          <label>Usuário / Email</label>
          <input
            type="text"
            placeholder="Buscar texto"
            value={userFilters.search}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <div className="filter-field">
          <label>Data inicial</label>
          <input
            type="date"
            value={userFilters.startDate}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, startDate: e.target.value }))}
          />
        </div>
        <div className="filter-field">
          <label>Data final</label>
          <input
            type="date"
            value={userFilters.endDate}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
        <button
          className="clear-button"
          type="button"
          onClick={() =>
            setUserFilters({
              status: '',
              search: '',
              startDate: '',
              endDate: '',
            })
          }
        >
          Limpar
        </button>
      </div>
      {loadingUsers ? (
        <p>Carregando usuários...</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th onClick={() => requestSort('name')} className="sortable-header">
                  Nome {getSortIndicator('name')}
                </th>
                <th onClick={() => requestSort('email')} className="sortable-header">
                  Email {getSortIndicator('email')}
                </th>
                <th onClick={() => requestSort('banned_until')} className="sortable-header">
                  Status {getSortIndicator('banned_until')}
                </th>
                <th onClick={() => requestSort('last_sign_in_at')} className="sortable-header">
                  Último acesso {getSortIndicator('last_sign_in_at')}
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    Nenhum usuário encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => {
                  const isBlocked = Boolean(user.banned_until);
                  return (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`status-pill ${isBlocked ? 'blocked' : 'active'}`}>
                          {isBlocked ? 'Bloqueado' : 'Ativo'}
                        </span>
                      </td>
                      <td>
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                          : '—'}
                      </td>
                      <td className="actions-cell">
                        <button
                          className="secondary"
                          onClick={() => handleUserBlockToggle(user.id, !isBlocked)}
                          disabled={Boolean(userActionMap[user.id])}
                        >
                          {isBlocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <button
                          className="danger"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={Boolean(userActionMap[user.id])}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-dashboard">
      <header>
        <div>
          <p className="subtitle">Painel Administrativo</p>
          <h2>
            {currentUser?.user?.user_metadata?.name ||
              currentUser?.user?.email ||
              currentUser?.email ||
              'Administrador'}
          </h2>
        </div>
      </header>

      {errorMessage && <div className="alert-error">{errorMessage}</div>}

      <section className="admin-grid">
        {renderReportsTable()}
        {renderUsersTable()}
      </section>

      {previewReport && (
        <div className="preview-backdrop" onClick={() => setPreviewReport(null)}>
          <div className="preview-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="preview-close"
              onClick={() => setPreviewReport(null)}
              aria-label="Fechar visualização"
            >
              ×
            </button>
            <div className="preview-header">
              <div>
                <p className="subtitle">Denúncia #{previewReport.id}</p>
                <h3>{previewReport.problem || 'Tipo não informado'}</h3>
              </div>
              <div className="preview-statuses">
                <span className={`status-pill ${previewReport.moderation_status || 'pendente'}`}>
                  {previewReport.moderation_status || 'pendente'}
                </span>
                <span className={`status-pill status-${previewReport.status || 'default'}`}>
                  {getStatusLabel(previewReport.status) || 'Sem status'}
                </span>
              </div>
            </div>

            <div className="preview-body">
              <div className="preview-image">
                {previewReport.image_url ? (
                  <img src={previewReport.image_url} alt={`Denúncia ${previewReport.id}`} />
                ) : (
                  <div className="preview-placeholder">Sem imagem enviada</div>
                )}
              </div>
              <div className="preview-details">
                <p><strong>Descrição:</strong> {previewReport.description || 'Nenhuma descrição fornecida.'}</p>
                <p><strong>Usuário:</strong> {previewReport.reporterName || '—'}</p>
                <p><strong>Email:</strong> {previewReport.reporterEmail || '—'}</p>
                <p>
                  <strong>Coordenadas:</strong>{' '}
                  {(previewReport.position?.lat ?? previewReport.lat)?.toFixed
                    ? `${Number(previewReport.position?.lat ?? previewReport.lat).toFixed(5)}, ${Number(previewReport.position?.lng ?? previewReport.lng).toFixed(5)}`
                    : '—'}
                </p>
                <p>
                  <strong>Criada em:</strong>{' '}
                  {previewReport.created_at
                    ? new Date(previewReport.created_at).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : '—'}
                </p>
              </div>
            </div>

            <div className="preview-actions">
              <button
                className="preview-action approve"
                disabled={Boolean(statusLoadingMap[previewReport.id])}
                onClick={() => handleModerateReport(previewReport.id, 'approve')}
              >
                Aprovar
              </button>
              <button
                className="preview-action reject"
                disabled={Boolean(statusLoadingMap[previewReport.id])}
                onClick={() => handleModerateReport(previewReport.id, 'reject')}
              >
                Rejeitar
              </button>
              <button className="clear-button" onClick={() => setPreviewReport(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
