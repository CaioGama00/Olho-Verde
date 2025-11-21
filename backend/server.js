require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./db');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = (process.env.HUGGINGFACE_MODEL || 'microsoft/resnet-50').trim();
const HUGGINGFACE_INFERENCE_URL = (process.env.HUGGINGFACE_INFERENCE_URL || `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`).trim();
const IMAGE_CLASSIFICATION_BYPASS = process.env.IMAGE_CLASSIFICATION_BYPASS === 'true';
const IMAGE_CLASSIFICATION_ENABLED = IMAGE_CLASSIFICATION_BYPASS || Boolean(HUGGINGFACE_API_KEY);
if (!IMAGE_CLASSIFICATION_ENABLED) {
  console.warn('HUGGINGFACE_API_KEY não definido. /api/classify-image ficará desabilitado.');
} else if (IMAGE_CLASSIFICATION_BYPASS) {
  console.warn('IMAGE_CLASSIFICATION_BYPASS=true: classificação será sempre aprovada.');
}

const normalizeBaseUrl = (input, fallback) => {
  const base = (input || fallback || '').trim();
  if (!base) {
    return '';
  }
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const FRONTEND_BASE_URL = normalizeBaseUrl(
  process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL,
  'http://localhost:5173'
);

const PASSWORD_RESET_REDIRECT_URL = (process.env.PASSWORD_RESET_REDIRECT_URL ||
  `${FRONTEND_BASE_URL || 'http://localhost:5173'}/reset-password`).trim();

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const REPORT_STATUSES = ['nova', 'em_analise', 'resolvida'];
const DEFAULT_REPORT_STATUS = REPORT_STATUSES[0];

const categoryThreshold = (envVar, fallback) => {
  const specific = Number(process.env[envVar]);
  if (!Number.isNaN(specific) && specific > 0) return specific;
  const shared = Number(process.env.CATEGORY_SCORE_THRESHOLD);
  if (!Number.isNaN(shared) && shared > 0) return shared;
  return fallback;
};

const REPORT_CATEGORIES = [
  {
    id: 'alagamento',
    label: 'Alagamento',
    keywords: ['flood', 'flooding', 'river', 'lake', 'canal', 'water', 'swamp', 'boat', 'ship', 'amphibious vehicle'],
    failureMessage: 'A imagem não parece mostrar ruas ou calçadas alagadas. Tente registrar a água cobrindo a via.',
    threshold: categoryThreshold('CATEGORY_THRESHOLD_ALAGAMENTO', 0.1),
  },
  {
    id: 'foco_lixo',
    label: 'Foco de lixo',
    keywords: ['trash', 'garbage', 'dump', 'landfill', 'dumpster', 'rubbish', 'litter', 'waste', 'dustcart', 'plastic bag'],
    failureMessage: 'A imagem não parece conter acúmulo de lixo. Procure focar nos sacos ou montes de resíduos.',
    threshold: categoryThreshold('CATEGORY_THRESHOLD_LIXO', 0.1),
  },
  {
    id: 'arvore_queda',
    label: 'Árvore caída',
    keywords: ['tree', 'trunk', 'branch', 'log', 'forest', 'wood'],
    failureMessage: 'Não identificamos uma árvore caída ou tronco quebrado na foto. Mostre o tronco no chão ou prestes a cair.',
    threshold: categoryThreshold('CATEGORY_THRESHOLD_ARVORE', 0.1),
  },
  {
    id: 'bueiro_entupido',
    label: 'Bueiro entupido',
    keywords: ['sewer', 'drain', 'manhole', 'gutter', 'culvert', 'pipe', 'dustcart', 'plastic bag'],
    failureMessage: 'A imagem não evidencia um bueiro ou ralo entupido. Foque na tampa ou na grade obstruída.',
    threshold: categoryThreshold('CATEGORY_THRESHOLD_BUEIRO', 0.1),
  },
  {
    id: 'buraco_via',
    label: 'Buraco na via',
    keywords: ['pothole', 'crack', 'asphalt', 'road', 'street', 'ditch', 'hole', 'road surface', 'manhole'],
    failureMessage: 'Não conseguimos ver buracos ou rachaduras na via. Aproxime a câmera do dano no asfalto.',
    threshold: categoryThreshold('CATEGORY_THRESHOLD_BURACO', 0.1),
  },
];

const CATEGORY_DEFAULT_THRESHOLD = Number(process.env.CATEGORY_SCORE_THRESHOLD) || 0.1;

const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'report-images';

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

const uploadImageToStorage = async (file, userId) => {
  if (!file) return null;
  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filePath = `${userId || 'anon'}/${safeName}${ext}`;

  const { data, error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data: publicData } = supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(data.path);

  return {
    fileId: data.path,
    publicUrl: publicData?.publicUrl || null,
  };
};

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

const buildReportResponse = (report, { includeReporterContact = false } = {}) => {
  const response = {
    ...report,
    status: report.status || DEFAULT_REPORT_STATUS,
    description: report.description || '',
    image_url: report.image_url || null,
    image_drive_id: report.image_drive_id || null,
    position: {
      lat: parseFloat(report.lat),
      lng: parseFloat(report.lng)
    }
  };

  if (includeReporterContact) {
    const reporterProfile = extractUserProfile(report.users);
    response.reporterName = reporterProfile.name;
    response.reporterEmail = reporterProfile.email;
  }

  return response;
};

// GET /api/reports - Get all reports
app.get('/api/reports', async (req, res) => {
  try {
    const currentUser = await getUserFromRequest(req);
    const currentUserId = currentUser?.id || null;

    const { data, error } = await supabase
      .from('reports')
      .select('*')
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
});

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
app.get('/api/reports/:id', async (req, res) => {
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
      .single();

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
});

// GET /api/reports/:id/comments - list comments
app.get('/api/reports/:id/comments', async (req, res) => {
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
});

// POST /api/reports/:id/comments - add new comment
app.post('/api/reports/:id/comments', authenticateToken, async (req, res) => {
  const reportId = parseInt(req.params.id, 10);
  if (Number.isNaN(reportId)) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  const content = (req.body?.content || '').trim();
  if (!content) {
    return res.status(400).json({ error: 'Comentário é obrigatório.' });
  }

  const { id: user_id } = req.user;
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
});

// POST /api/reports - Create a new report (protected)
app.post('/api/reports', authenticateToken, upload.single('image'), async (req, res) => {
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
      payload.image_drive_id = imageData.fileId; // storing path for reference
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
});

// POST /api/reports/:id/vote - Vote on a report (protected)
app.post('/api/reports/:id/vote', authenticateToken, async (req, res) => {
  const reportId = parseInt(req.params.id, 10);
  const { vote } = req.body; // expecting { vote: 'up' } | 'down' | null
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
});

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', async (req, res) => {
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
});

// POST /api/auth/login - Login a user
app.post('/api/auth/login', async (req, res) => {
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
});

// PUT /api/auth/profile - Update user profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { name, password } = req.body;
  const { id } = req.user;

  try {
    const updates = {
      user_metadata: { name }, // Update metadata
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
});

app.post('/api/auth/password-reset/request', async (req, res) => {
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
});

app.post('/api/auth/password-reset/confirm', async (req, res) => {
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
});

const classifyImageBuffer = async (file, expectedCategoryId = null) => {
  if (!IMAGE_CLASSIFICATION_ENABLED || IMAGE_CLASSIFICATION_BYPASS) {
    const disabledError = new Error('IMAGE_CLASSIFICATION_DISABLED');
    disabledError.status = 503;
    throw disabledError;
  }

  let predictions = [];
  try {
    const response = await axios.post(HUGGINGFACE_INFERENCE_URL, file.buffer, {
      headers: {
        Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
        Accept: 'application/json',
        'Content-Type': file.mimetype || 'application/octet-stream',
      },
      responseType: 'json',
      timeout: 60000,
    });
    predictions = Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    const fallback = new Error('HF_INFERENCE_ERROR');
    fallback.data = error.response?.data;
    throw fallback;
  }

  const matches = predictions
    .flatMap((prediction) => {
      const label = (prediction.label || '').toLowerCase();
      const score = prediction.score || 0;
      return REPORT_CATEGORIES
        .filter((cat) => cat.keywords.some((keyword) => label.includes(keyword)))
        .map((category) => ({ label, score, category }));
    })
    .filter(
      (prediction) =>
        prediction.category &&
        prediction.score >= (prediction.category.threshold ?? CATEGORY_DEFAULT_THRESHOLD)
    )
    .sort((a, b) => b.score - a.score);

  console.log('Predições recebidas:', predictions.slice(0, 5));
  console.log('Correspondências identificadas:', matches.slice(0, 5));

  return {
    bestMatch: matches.find((match) => match.category.id === expectedCategoryId) || matches[0] || null,
    topPrediction: predictions[0] || null,
  };
};

app.post('/api/classify-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
  }

  if (IMAGE_CLASSIFICATION_BYPASS) {
    const expectedCategoryId = req.body.expectedCategoryId;
    const expectedCategory = REPORT_CATEGORIES.find((cat) => cat.id === expectedCategoryId);
    return res.json({
      success: true,
      detectedCategoryId: expectedCategoryId || null,
      detectedCategoryLabel: expectedCategory?.label || null,
      confidence: 1,
      bypass: true,
    });
  }

  if (!IMAGE_CLASSIFICATION_ENABLED) {
    return res.status(503).json({ error: 'Classificação de imagem desativada. Configure HUGGINGFACE_API_KEY.' });
  }

  const expectedCategoryId = req.body.expectedCategoryId;
  const expectedCategory = REPORT_CATEGORIES.find((cat) => cat.id === expectedCategoryId);

  try {
    const { bestMatch, topPrediction } = await classifyImageBuffer(req.file, expectedCategoryId);

    if (!bestMatch) {
      const message = expectedCategory?.failureMessage ||
        'Não conseguimos identificar o problema na imagem. Envie outra foto com mais detalhes.';
      return res.status(422).json({ success: false, error: message, topPrediction });
    }

    if (expectedCategory && bestMatch.category.id !== expectedCategory.id) {
      return res.status(422).json({
        success: false,
        error: expectedCategory.failureMessage,
        detectedCategoryId: bestMatch.category.id,
        detectedCategoryLabel: bestMatch.category.label,
        confidence: bestMatch.score,
        topPrediction,
      });
    }

    res.json({
      success: true,
      detectedCategoryId: bestMatch.category.id,
      detectedCategoryLabel: bestMatch.category.label,
      confidence: bestMatch.score,
      topPrediction,
    });
  } catch (error) {
    const status = error.status || error.response?.status || 500;
    const data = error.data || error.response?.data;
    console.error('Error classifying image:', data || error.message);

    let message = 'Falha ao classificar a imagem.';
    if (error.message === 'IMAGE_CLASSIFICATION_DISABLED') {
      message = 'Classificação desativada.';
    } else if (status === 401 || status === 403) {
      message = 'HuggingFace API key inválida ou sem permissão.';
    }

    res.status(503).json({ error: message, details: data || null });
  }
});


// POST /api/auth/refresh - refresh Supabase session
app.post('/api/auth/refresh', async (req, res) => {
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
});

// Admin: Fetch all reports with owner data
app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
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
});

// Admin: Update report status
app.patch('/api/admin/reports/:id/status', authenticateToken, requireAdmin, async (req, res) => {
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
});

// Admin: List users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
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
});

// Admin: Block/Unblock user
app.patch('/api/admin/users/:id/block', authenticateToken, requireAdmin, async (req, res) => {
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
});

// Admin: Delete user
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
