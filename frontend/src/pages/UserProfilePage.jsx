import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import './UserProfilePage.css';

const UserProfilePage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
            navigate('/login');
            return;
        }
        setUser(currentUser);

        const metaName = currentUser.user?.user_metadata?.name || '';
        setName(metaName);
        setEmail(currentUser.user?.email || '');
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (password && password !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem.' });
            return;
        }

        setLoading(true);
        try {
            await authService.updateProfile(name, password);
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
            setPassword('');
            setConfirmPassword('');
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Erro ao atualizar perfil.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-page-container">
            <div className="profile-card">
                <div className="profile-header">
                    <div className="profile-avatar">
                        {name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
                    </div>
                    <h2>Meu Perfil</h2>
                    <p className="profile-email">{email}</p>
                </div>

                {message.text && (
                    <div className={`message-banner ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="profile-form">
                    <div className="form-group">
                        <label htmlFor="name">Nome de Exibição</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Seu nome"
                        />
                    </div>

                    <div className="form-divider">
                        <span>Alterar Senha (Opcional)</span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Nova Senha</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Deixe em branco para manter a atual"
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirmar Nova Senha</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repita a nova senha"
                            disabled={!password}
                        />
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => navigate('/')}>
                            Voltar ao Mapa
                        </button>
                        <button type="submit" className="btn-save" disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserProfilePage;
