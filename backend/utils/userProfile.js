const supabase = require('../db');

const extractUserProfile = (user) => {
    if (!user) {
        return { name: null, email: null };
    }

    const rawMeta = user.raw_user_meta_data || user.user_metadata || {};
    const name = user.name || rawMeta.name || null;
    const email = user.email || rawMeta.email || null;

    return { name, email };
};

const fetchUserProfilesByIds = async (userIds = []) => {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
        return new Map();
    }

    const profileEntries = await Promise.all(
        uniqueIds.map(async (id) => {
            try {
                const { data, error } = await supabase.auth.admin.getUserById(id);
                if (error) throw error;
                return [id, data?.user || null];
            } catch (err) {
                console.error(`Falha ao buscar perfil do usuário ${id}:`, err?.message || err);
                return [id, null];
            }
        })
    );

    return new Map(profileEntries);
};

module.exports = {
    extractUserProfile,
    fetchUserProfilesByIds,
};
