const supabase = require('../db');
const { buildReportResponse } = require('../utils/reportHelpers');
const { fetchUserProfilesByIds } = require('../utils/userProfile');
const { REPORT_STATUSES } = require('../config/constants');
const { sendEmail } = require('../services/emailService');

const STATUS_LABELS = {
  nova: 'Recebida',
  em_analise: 'Em andamento',
  resolvida: 'Resolvida',
};

const safeReporterName = (report) =>
  report?.users?.full_name ||
  report?.users?.name ||
  report?.users?.user_metadata?.name ||
  '';

//function to send status update email to reporter
async function sendStatusUpdateEmail(report, status) {
  if (!report?.users?.email) return;
  const statusLabel = STATUS_LABELS[status] || status || 'Atualizado';
  const reporterName = safeReporterName(report);

  await sendEmail({
    to: report.users.email,
    subject: `Sua denúncia foi atualizada: ${statusLabel}`,
    html: `
      <p>Olá ${reporterName || 'morador(a)'},</p>
      <p>Atualizamos sua denúncia ${report.id ? `(#${report.id})` : ''}.</p>
      <ul>
        <li><strong>Status:</strong> ${statusLabel}</li>
        <li><strong>Tipo:</strong> ${report.problem || 'Não informado'}</li>
        <li><strong>Descrição:</strong> ${report.description || 'Sem descrição'}</li>
      </ul>
      <p>${status === 'resolvida'
        ? 'Encerramos o chamado. Obrigado por avisar e contar com a gente!'
        : 'Já estamos cuidando disso e avisaremos quando houver novidades.'}</p>
      <p>Equipe Olho Verde</p>
    `,
  });
}

async function sendModerationEmail(report, action, reason) {
  if (!report?.users?.email) return;
  const reporterName = safeReporterName(report);
  const statusLabel = STATUS_LABELS[report.status] || report.status || 'Em andamento';
  const isApproved = action === 'approve';

  await sendEmail({
    to: report.users.email,
    subject: isApproved ? 'Sua denúncia foi aprovada' : 'Sua denúncia foi rejeitada',
    html: `
      <p>Olá ${reporterName || 'morador(a)'},</p>
      <p>Sua denúncia ${report.id ? `(#${report.id})` : ''} foi ${isApproved ? 'aprovada' : 'rejeitada'} pela moderação.</p>
      ${isApproved
        ? `<p>Ela ficará visível no mapa com o status <strong>${statusLabel}</strong>.</p>`
        : `<p>Motivo: <strong>${reason || 'Não informado'}</strong></p>`}
      <ul>
        <li><strong>Tipo:</strong> ${report.problem || 'Não informado'}</li>
        <li><strong>Descrição:</strong> ${report.description || 'Sem descrição'}</li>
      </ul>
      <p>Obrigado por usar o Olho Verde.</p>
    `,
  });
}

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
        await sendStatusUpdateEmail(reportWithUser, status);

        res.json(buildReportResponse(reportWithUser, { includeReporterContact: true }));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin: Moderate report (approve/reject)
const moderateReport = async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    const { action, reason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Ação inválida. Use "approve" ou "reject".' });
    }

    if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ error: 'O motivo é obrigatório.' });
    }

    if (reason.trim().length > 500) {
        return res.status(400).json({ error: 'O motivo deve ter no máximo 500 caracteres.' });
    }

    const moderationStatus = action === 'approve' ? 'aprovado' : 'rejeitado';
    const { id: adminId } = req.user;

    try {
        const { data, error } = await supabase
            .from('reports')
            .update({
                moderation_status: moderationStatus,
                moderation_reason: reason.trim(),
                moderated_by: adminId,
                moderated_at: new Date().toISOString(),
            })
            .eq('id', reportId)
            .select('*')
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Report não encontrado.' });
        }

        const profileMap = await fetchUserProfilesByIds([data.user_id, data.moderated_by]);

        const reportWithUser = {
            ...data,
            users: profileMap.get(data.user_id) || null,
            moderator: profileMap.get(data.moderated_by) || null,
        };

        try {
            await sendModerationEmail(reportWithUser, action, reason);
        } catch (emailErr) {
            console.error('Erro ao enviar email de moderação:', emailErr?.message || emailErr);
        }

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
    moderateReport,
    listUsers,
    toggleUserBlock,
    deleteUser,
};
