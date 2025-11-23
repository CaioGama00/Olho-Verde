const supabase = require('../db');
const { PASSWORD_RESET_REDIRECT_URL } = require('../config/env');
const { isAdminUser } = require('../middleware/auth');

// POST /api/auth/register - Register a new user
const register = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                },
            },
        });

        if (error) {
            throw error;
        }

        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            return res.status(400).json({ message: 'Este email já está cadastrado.' });
        }

        res.status(201).json({ message: 'User created successfully', user: data.user });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message || 'Falha ao registrar usuário.' });
    }
};

// POST /api/auth/login - Login a user
const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        res.json({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            user: data.user,
            isAdmin: isAdminUser(data.user),
        });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
};

// PUT /api/auth/profile - Update user profile
const updateProfile = async (req, res) => {
    const { name, password } = req.body;
    const { id } = req.user;

    try {
        const updates = {
            user_metadata: { name },
        };

        if (password && password.trim().length > 0) {
            updates.password = password;
        }

        const { data, error } = await supabase.auth.admin.updateUserById(id, updates);

        if (error) throw error;

        try {
            await supabase.from('users').update({ name }).eq('id', id);
        } catch (syncErr) {
            console.warn('Não foi possível sincronizar nome em public.users:', syncErr?.message || syncErr);
        }

        res.json({
            message: 'Perfil atualizado com sucesso.',
            user: data.user,
        });
    } catch (err) {
        console.error('Erro ao atualizar perfil:', err);
        res.status(400).json({ message: err.message || 'Falha ao atualizar perfil.' });
    }
};

// POST /api/auth/password-reset/request
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'O email é obrigatório.' });
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: PASSWORD_RESET_REDIRECT_URL,
        });

        if (error) throw error;

        res.json({
            message: 'Se encontrarmos este email, enviaremos um link de redefinição nos próximos minutos.',
        });
    } catch (err) {
        console.error('Erro ao solicitar redefinição de senha:', err);
        res.status(400).json({
            message: err.message || 'Não foi possível iniciar a redefinição de senha.',
        });
    }
};

// POST /api/auth/password-reset/confirm
const confirmPasswordReset = async (req, res) => {
    const { accessToken, newPassword } = req.body;

    if (!accessToken || !newPassword) {
        return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error) {
            throw error;
        }

        if (!user) {
            return res.status(400).json({ message: 'Token inválido ou expirado.' });
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
            password: newPassword,
        });

        if (updateError) throw updateError;

        res.json({ message: 'Senha atualizada com sucesso. Faça login novamente.' });
    } catch (err) {
        console.error('Erro ao confirmar redefinição de senha:', err);
        res.status(400).json({
            message: err.message || 'Não foi possível atualizar a senha.',
        });
    }
};

// POST /api/auth/refresh - refresh Supabase session
const refresh = async (req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({ message: 'refreshToken is required' });
    }

    try {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (error || !data?.session || !data?.user) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        res.json({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            user: data.user,
            session: data.session,
            isAdmin: isAdminUser(data.user),
        });
    } catch (err) {
        console.error('Refresh error:', err);
        res.status(401).json({ message: 'Invalid refresh token' });
    }
};

module.exports = {
    register,
    login,
    updateProfile,
    requestPasswordReset,
    confirmPasswordReset,
    refresh,
};
