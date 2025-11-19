import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import authService from '../services/authService';

const Navbar = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnMap = location.pathname === '/';

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      await authService.logout();
    }
    navigate('/login');
  };

  const displayName = currentUser?.user?.user_metadata?.name || currentUser?.user?.email || currentUser?.email;

  return (
    <nav>
      {!isOnMap && <Link to="/">Mapa</Link>}
      {currentUser ? (
        <div>
          {currentUser.isAdmin && (
            <Link to="/admin">Painel Admin</Link>
          )}
          <Link to="/minhas-denuncias">Minhas Denúncias</Link>
          <button type="button" className="user-chip" title="Perfil do usuário">
            {displayName}
          </button>
          <button onClick={handleLogout}>Sair</button>
        </div>
      ) : (
        <div>
          <Link to="/login">Entrar</Link>
          <Link to="/register">Cadastro</Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
