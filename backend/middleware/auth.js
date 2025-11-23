const supabase = require('../db');
const { ADMIN_EMAILS } = require('../config/env');

const hasAdminFlag = (metadata = {}) => {
    const role = typeof metadata.role === 'string' ? metadata.role.toLowerCase() : null;
    const roles = Array.isArray(metadata.roles)
        ? metadata.roles.map((item) => (typeof item === 'string' ? item.toLowerCase() : item))
        : [];
    return (
        metadata.is_admin === true ||
        role === 'admin' ||
        roles.includes('admin')
    );
};

const isAdminUser = (user) => {
    if (!user) return false;
    if (hasAdminFlag(user.user_metadata) || hasAdminFlag(user.app_metadata)) {
        return true;
    }
    const email = user.email?.toLowerCase();
    return email ? ADMIN_EMAILS.has(email) : false;
};

const getUserFromRequest = async (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return null;

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return null;
    }

    return user;
};

// Middleware to verify Supabase JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
        return res.status(401).json({ error: error.message });
    }

    req.user = user;
    req.isAdmin = isAdminUser(user);
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.isAdmin) {
        return res.status(403).json({ error: 'Acesso permitido apenas para administradores.' });
    }
    next();
};

module.exports = {
    authenticateToken,
    requireAdmin,
    getUserFromRequest,
    isAdminUser,
};
