const supabase = require('../db');
const { buildReportResponse } = require('../utils/reportHelpers');
const { fetchUserProfilesByIds } = require('../utils/userProfile');
const { REPORT_STATUSES } = require('../config/constants');

// Admin: Fetch all reports with owner data
const getAllReports = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        const profileMap = await fetchUserProfilesByIds(data.map((report) => report.user_id));
        const enriched = data.map((report) =>
            buildReportResponse(
                { ...report, users: profileMap.get(report.user_id) || null },
                { includeReporterContact: true }
            )
        );

        res.json(enriched);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin: Update report status
const updateReportStatus = async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!REPORT_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status inválido.' });
    }

    try {
        const { data, error } = await supabase
            .from('reports')
            .update({ status })
            .eq('id', reportId)
            .select('*')
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Report não encontrado.' });
        }

        const profileMap = await fetchUserProfilesByIds([data.user_id]);
        const reportWithUser = { ...data, users: profileMap.get(data.user_id) || null };

        res.json(buildReportResponse(reportWithUser, { includeReporterContact: true }));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin: List users
const listUsers = async (req, res) => {
    try {
        const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
        if (error) throw error;

        const users = data.users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            banned_until: user.banned_until || null,
        }));

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin: Block/Unblock user
const toggleUserBlock = async (req, res) => {
    const { id } = req.params;
    const { block } = req.body;

    if (typeof block !== 'boolean') {
        return res.status(400).json({ error: 'O campo "block" deve ser booleano.' });
    }

    try {
        const { data, error } = await supabase.auth.admin.updateUserById(id, {
            ban_duration: block ? 'forever' : 'none',
        });
        if (error) throw error;

        res.json({
            id: data.id,
            email: data.email,
            name: data.user_metadata?.name || data.email,
            banned_until: data.banned_until || null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin: Delete user
const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const { error } = await supabase.auth.admin.deleteUser(id);
        if (error) throw error;

        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getAllReports,
    updateReportStatus,
    listUsers,
    toggleUserBlock,
    deleteUser,
};
