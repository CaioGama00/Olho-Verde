const axios = require('axios');
const path = require('path');
const supabase = require('../db');
const { getUserFromRequest } = require('../middleware/auth');
const { buildReportResponse } = require('../utils/reportHelpers');
const { DEFAULT_REPORT_STATUS } = require('../config/constants');
const { SUPABASE_STORAGE_BUCKET } = require('../config/env');
const { uploadImageToStorage } = require('../services/storageService');

// GET /api/reports - Get all reports
const getAllReports = async (req, res) => {
    try {
        const currentUser = await getUserFromRequest(req);
        const currentUserId = currentUser?.id || null;

        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .eq('moderation_status', 'aprovado')
            .order('created_at', { ascending: false });
        if (error) throw error;

        let voteMap = new Map();
        if (currentUserId) {
            const { data: votes, error: voteError } = await supabase
                .from('user_votes')
                .select('report_id, vote_value')
                .eq('user_id', currentUserId);

            if (voteError) throw voteError;
            voteMap = new Map(
                (votes || []).map((vote) => [vote.report_id, vote.vote_value])
            );
        }

        const reports = data.map((report) => {
            const response = buildReportResponse(report);
            if (voteMap.has(report.id)) {
                const voteValue = voteMap.get(report.id);
                response.user_vote = voteValue === 1 ? 'up' : voteValue === -1 ? 'down' : null;
            } else {
                response.user_vote = null;
            }
            return response;
        });
        res.json(reports);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Helper function to fetch comments for a report
const fetchCommentsForReport = async (reportId) => {
    const { data, error } = await supabase
        .from('report_comments')
        .select('id, content, created_at, user_id, users(name, email)')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((comment) => ({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user_id: comment.user_id,
        author_name: comment.users?.name || comment.users?.email || 'Usuário',
        author_email: comment.users?.email || null,
    }));
};

// GET /api/reports/:id - Report details + comments + user vote
const getReportById = async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    if (Number.isNaN(reportId)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    try {
        const currentUser = await getUserFromRequest(req);
        const currentUserId = currentUser?.id || null;

        const { data: report, error } = await supabase
            .from('reports')
            .select('*')
            .eq('id', reportId)
            .eq('moderation_status', 'aprovado')
            .maybeSingle();

        if (error) throw error;
        if (!report) return res.status(404).json({ error: 'Report não encontrado' });

        let userVote = null;
        if (currentUserId) {
            const { data: vote } = await supabase
                .from('user_votes')
                .select('vote_value')
                .eq('user_id', currentUserId)
                .eq('report_id', reportId)
                .maybeSingle();
            if (vote) {
                userVote = vote.vote_value === 1 ? 'up' : vote.vote_value === -1 ? 'down' : null;
            }
        }

        const comments = await fetchCommentsForReport(reportId);
        const response = buildReportResponse(report);
        response.user_vote = userVote;
        response.comments = comments;

        res.json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /api/reports/:id/comments - list comments
const getReportComments = async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    if (Number.isNaN(reportId)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    try {
        const comments = await fetchCommentsForReport(reportId);
        res.json({ comments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /api/reports/:id/comments - add new comment
const addComment = async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    if (Number.isNaN(reportId)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }
    const content = (req.body?.content || '').trim();
    if (!content) {
        return res.status(400).json({ error: 'Comentário é obrigatório.' });
    }

    const { id: user_id } = req.user;
    const { extractUserProfile } = require('../utils/userProfile');
    const { name, email } = extractUserProfile(req.user);

    try {
        const { data, error } = await supabase
            .from('report_comments')
            .insert([{ content, report_id: reportId, user_id }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            id: data.id,
            content: data.content,
            created_at: data.created_at,
            user_id,
            author_name: name || email || 'Você',
            author_email: email || null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /api/reports - Create a new report
const createReport = async (req, res) => {
    const body = req.body || {};
    const { problem, description = '' } = body;
    const lat = body.lat ?? body.position?.lat;
    const lng = body.lng ?? body.position?.lng;
    const { id: user_id } = req.user;

    if (!problem || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: 'Problema, latitude e longitude são obrigatórios.' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        return res.status(400).json({ error: 'Latitude/Longitude inválidas.' });
    }

    let imageData = null;

    try {
        if (req.file) {
            imageData = await uploadImageToStorage(req.file, user_id);
        }

        const payload = {
            problem,
            lat: latNum,
            lng: lngNum,
            user_id,
            description,
            status: DEFAULT_REPORT_STATUS,
        };

        if (imageData) {
            payload.image_url = imageData.publicUrl;
            payload.image_drive_id = imageData.fileId;
        }

        const { data, error } = await supabase
            .from('reports')
            .insert([payload])
            .select();

        if (error) throw error;

        const newReport = {
            ...buildReportResponse(data[0]),
            user_vote: null,
        };
        res.status(201).json(newReport);
    } catch (err) {
        console.error(err);
        const message = err?.message || 'Internal server error';
        res.status(500).json({ error: 'Internal server error', details: message });
    }
};

// POST /api/reports/:id/vote - Vote on a report
const voteOnReport = async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    const { vote } = req.body;
    const { id: user_id } = req.user;

    let voteValue;
    if (vote === 'up') {
        voteValue = 1;
    } else if (vote === 'down') {
        voteValue = -1;
    } else if (vote === null || vote === 'none') {
        voteValue = 0;
    } else {
        return res.status(400).json({ message: 'Invalid vote type' });
    }

    try {
        const { data: report, error: reportError } = await supabase
            .from('reports')
            .select('upvotes, downvotes')
            .eq('id', reportId)
            .single();

        if (reportError) throw reportError;
        if (!report) return res.status(404).json({ message: 'Report not found' });

        const { data: existingVote, error: existingError } = await supabase
            .from('user_votes')
            .select('vote_value')
            .eq('user_id', user_id)
            .eq('report_id', reportId)
            .maybeSingle();

        if (existingError) throw existingError;

        let upvotes = report.upvotes || 0;
        let downvotes = report.downvotes || 0;

        if (!existingVote && voteValue === 0) {
            return res.json({ upvotes, downvotes, user_vote: null });
        }

        if (!existingVote) {
            if (voteValue === 1) upvotes += 1;
            if (voteValue === -1) downvotes += 1;
            await supabase
                .from('user_votes')
                .insert([{ user_id, report_id: reportId, vote_value: voteValue }]);
        } else {
            if (existingVote.vote_value === voteValue) {
                return res.json({
                    upvotes,
                    downvotes,
                    user_vote: voteValue === 1 ? 'up' : voteValue === -1 ? 'down' : null,
                });
            }

            if (existingVote.vote_value === 1) upvotes -= 1;
            if (existingVote.vote_value === -1) downvotes -= 1;

            if (voteValue === 0) {
                await supabase
                    .from('user_votes')
                    .delete()
                    .eq('user_id', user_id)
                    .eq('report_id', reportId);
            } else {
                if (voteValue === 1) upvotes += 1;
                if (voteValue === -1) downvotes += 1;
                await supabase
                    .from('user_votes')
                    .update({ vote_value: voteValue })
                    .eq('user_id', user_id)
                    .eq('report_id', reportId);
            }
        }

        await supabase
            .from('reports')
            .update({ upvotes, downvotes })
            .eq('id', reportId);

        res.json({
            upvotes,
            downvotes,
            user_vote: voteValue === 1 ? 'up' : voteValue === -1 ? 'down' : null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /api/reports/:id/image-proxy - proxy image to avoid CORS issues
const proxyReportImage = async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    if (Number.isNaN(reportId)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    try {
        const { data: report, error } = await supabase
            .from('reports')
            .select('id, image_url, image_drive_id')
            .eq('id', reportId)
            .maybeSingle();

        if (error) throw error;
        if (!report) return res.status(404).json({ error: 'Report não encontrado' });

        let sourceUrl = report.image_url || null;

        if (!sourceUrl && report.image_drive_id) {
            const { data: signed, error: signErr } = await supabase.storage
                .from(SUPABASE_STORAGE_BUCKET)
                .createSignedUrl(report.image_drive_id, 60);
            if (signErr) throw signErr;
            sourceUrl = signed?.signedUrl || null;
        }

        if (!sourceUrl) {
            return res.status(404).json({ error: 'Nenhuma imagem disponível para este report.' });
        }

        if (report.image_drive_id) {
            try {
                const pathInBucket = report.image_drive_id;
                const { data: fileStream, error: downloadError } = await supabase.storage
                    .from(SUPABASE_STORAGE_BUCKET)
                    .download(pathInBucket);

                if (downloadError) throw downloadError;

                const ext = path.extname(pathInBucket).toLowerCase();
                const mimeMap = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.webp': 'image/webp',
                    '.gif': 'image/gif',
                    '.avif': 'image/avif',
                    '.svg': 'image/svg+xml',
                };
                const contentType = mimeMap[ext] || 'application/octet-stream';
                res.setHeader('Content-Type', contentType);

                if (fileStream && typeof fileStream.pipe === 'function') {
                    fileStream.pipe(res);
                } else if (fileStream && typeof fileStream.arrayBuffer === 'function') {
                    const buffer = Buffer.from(await fileStream.arrayBuffer());
                    res.end(buffer);
                } else {
                    const { data: signed, error: signErr } = await supabase.storage
                        .from(SUPABASE_STORAGE_BUCKET)
                        .createSignedUrl(pathInBucket, 60);
                    if (signErr) throw signErr;
                    const response = await axios.get(signed.signedUrl, { responseType: 'stream' });
                    if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
                    response.data.pipe(res);
                }
                return;
            } catch (err) {
                console.error('Erro ao baixar diretamente do storage:', err?.message || err);
            }
        }

        const response = await axios.get(sourceUrl, { responseType: 'stream' });

        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        response.data.pipe(res);
    } catch (err) {
        console.error('Erro no image-proxy:', err?.message || err);
        res.status(502).json({ error: 'Falha ao buscar a imagem.' });
    }
};

module.exports = {
    getAllReports,
    getReportById,
    getReportComments,
    addComment,
    createReport,
    voteOnReport,
    proxyReportImage,
};
