import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../services/authService';

const Navbar = ({ currentUser }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  return (
    <nav>
      <Link to="/">Início</Link>
      {currentUser ? (
        <div>
          <span>{currentUser.user_metadata?.name || currentUser.email}</span>
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
