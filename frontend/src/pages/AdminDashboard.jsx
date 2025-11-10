import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../services/adminService';
import { REPORT_STATUS_OPTIONS } from '../utils/reportStatus';
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

  const renderReportsTable = () => (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3>Painel de Denúncias</h3>
        <button onClick={fetchReports} className="refresh-button">
          Atualizar
        </button>
      </div>
      {loadingReports ? (
        <p>Carregando denúncias...</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Problema</th>
                <th>Usuário</th>
                <th>Email</th>
                <th>Status</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    Nenhuma denúncia cadastrada ainda.
                  </td>
                </tr>
              ) : (
                reports.map((report, index) => (
                  <tr key={report.id}>
                    <td>{index + 1}</td>
                    <td>{report.problem}</td>
                    <td>{report.reporterName || '—'}</td>
                    <td>{report.reporterEmail || '—'}</td>
                    <td>
                      <select
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
      {loadingUsers ? (
        <p>Carregando usuários...</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Status</th>
                <th>Último acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    Não há usuários cadastrados.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
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
    </div>
  );
};

export default AdminDashboard;
