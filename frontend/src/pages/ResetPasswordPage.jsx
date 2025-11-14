import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import './ResetPasswordPage.css';

const ResetPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState('request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accessToken, setAccessToken] = useState(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const type = params.get('type');
    const token = params.get('access_token');

    if (type === 'recovery' && token) {
      setMode('confirm');
      setAccessToken(token);
      setMessage('Informe a nova senha que deseja utilizar.');
      setIsError(false);
    }

    // Remove sensitive tokens from the address bar after parsing
    window.history.replaceState({}, document.title, `${location.pathname}${location.search}`);
  }, [location.hash, location.pathname, location.search]);

  const resetState = () => {
    setMessage('');
    setIsError(false);
  };

  const handleRequestReset = async (event) => {
    event.preventDefault();
    resetState();

    if (!email.trim()) {
      setMessage('Informe um email válido.');
      setIsError(true);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await authService.requestPasswordReset(email.trim());
      setMessage(response.message || 'Se encontrarmos este email, enviaremos um link em instantes.');
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.message || 'Não foi possível enviar o email. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReset = async (event) => {
    event.preventDefault();
    resetState();

    if (!accessToken) {
      setIsError(true);
      setMessage('Token de redefinição não encontrado. Solicite um novo email.');
      return;
    }

    if (!newPassword) {
      setIsError(true);
      setMessage('Informe a nova senha.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setIsError(true);
      setMessage('As senhas digitadas não conferem.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await authService.confirmPasswordReset(accessToken, newPassword);
      setMessage(response.message || 'Senha atualizada com sucesso. Você já pode fazer login.');
      setIsError(false);
      setTimeout(() => navigate('/login'), 2500);
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.message || 'Não foi possível atualizar a senha. Solicite um novo link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="overlay-form-wrapper">
      <div className="reset-container">
        <h2>{mode === 'confirm' ? 'Definir nova senha' : 'Recuperar senha'}</h2>
        {mode === 'confirm' ? (
          <form className="reset-form" onSubmit={handleConfirmReset}>
            <div className="form-group">
              <label>Nova senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Confirme a nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
            <button type="submit" className="reset-button" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Atualizar senha'}
            </button>
          </form>
        ) : (
          <form className="reset-form" onSubmit={handleRequestReset}>
            <div className="form-group">
              <label>Email cadastrado</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <button type="submit" className="reset-button" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
        )}

        {message && (
          <p className={`message ${isError ? '' : 'success'}`}>
            {message}
          </p>
        )}

        <div className="reset-links">
          <Link to="/login">Voltar ao login</Link>
          {mode === 'confirm' && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setMode('request');
                setAccessToken(null);
                setNewPassword('');
                setConfirmPassword('');
                resetState();
              }}
            >
              Não recebeu o email?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
