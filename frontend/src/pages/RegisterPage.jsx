import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import authService from '../services/authService';
import './RegisterPage.css';

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setMessage('');
    setError(false);
    setIsSubmitting(true);
    try {
      const response = await authService.register(name, email, password);
      setMessage(response.message);
      setError(false);
    } catch (error) {
      const reason = error?.response?.data?.message || 'Não foi possível cadastrar agora.';
      setMessage('Falha no cadastro: ' + reason);
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="overlay-form-wrapper">
      <div className="register-container">
        <h2>Cadastro</h2>
        <form onSubmit={handleRegister} className="register-form">
          <div className="form-group">
            <label>Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <div className="password-wrapper">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <span onClick={() => setShowPassword(!showPassword)} className="password-toggle-icon">
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>
          <button type="submit" className="register-button" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Criar Conta'}
          </button>
        </form>
        {message && <p className={`message ${error ? '' : 'success'}`}>{message}</p>}
      </div>
    </div>
  );
};

export default RegisterPage;
