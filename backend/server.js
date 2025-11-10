require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./db');
const multer = require('multer');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3001;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY; // Optional for local testing
const DEFAULT_HF_URL = 'https://router.huggingface.co/hf-inference/models/microsoft/resnet-50';
const HUGGINGFACE_INFERENCE_URL = (() => {
  const rawUrl = process.env.HUGGINGFACE_INFERENCE_URL;
  if (!rawUrl) return DEFAULT_HF_URL;
  if (rawUrl.includes('api-inference.huggingface.co')) {
    console.warn(
      'HUGGINGFACE_INFERENCE_URL aponta para api-inference (depreciado). Usando automaticamente o router.huggingface.co.'
    );
    return DEFAULT_HF_URL;
  }
  return rawUrl;
})();
const MOCK_CLASSIFICATION = process.env.MOCK_CLASSIFICATION === 'true';
const IMAGE_CLASSIFICATION_ENABLED = Boolean(HUGGINGFACE_API_KEY);
if (!IMAGE_CLASSIFICATION_ENABLED && !MOCK_CLASSIFICATION) {
  console.warn('HUGGINGFACE_API_KEY não definido. /api/classify-image ficará desabilitado (ou ative MOCK_CLASSIFICATION=true para testes locais).');
}

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const REPORT_STATUSES = ['nova', 'em_analise', 'resolvida'];
const DEFAULT_REPORT_STATUS = REPORT_STATUSES[0];

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

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
    position: {
      lat: parseFloat(report.lat),
      lng: parseFloat(report.lng)
    }
  };

  if (includeReporterContact) {
    response.reporterName = report.users?.name || null;
    response.reporterEmail = report.users?.email || null;
  }

  return response;
};

// GET /api/reports - Get all reports
app.get('/api/reports', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const reports = data.map((report) => buildReportResponse(report));
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports - Create a new report (protected)
app.post('/api/reports', authenticateToken, async (req, res) => {
    const { problem, position } = req.body;
    const { lat, lng } = position;
    const { id: user_id } = req.user;

    try {
    const { data, error } = await supabase
        .from('reports')
        .insert([{ problem, lat, lng, user_id, status: DEFAULT_REPORT_STATUS }])
        .select();

    if (error) throw error;

    const newReport = buildReportResponse(data[0]);
    res.status(201).json(newReport);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
          user: data.user,
          isAdmin: isAdminUser(data.user),
        });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
});

const trashKeywords = [
  'trash heap',
  'trash pile',
  'garbage pile',
  'garbage heap',
  'street trash',
  'street garbage',
  'street litter',
  'roadside litter',
  'illegal dumping',
  'dumped trash',
  'dumped garbage'
];

const classifyImageBuffer = async (file) => {
  if (!IMAGE_CLASSIFICATION_ENABLED) {
    if (MOCK_CLASSIFICATION) {
      return { isTrash: (file.buffer.length % 3) === 0 };
    }
    const disabledError = new Error('IMAGE_CLASSIFICATION_DISABLED');
    disabledError.status = 503;
    throw disabledError;
  }

  const response = await axios.post(HUGGINGFACE_INFERENCE_URL, file.buffer, {
    headers: {
      Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': file.mimetype || 'application/octet-stream',
      'X-Wait-For-Model': 'true',
    },
    responseType: 'json',
    timeout: 60000,
    validateStatus: (status) => status < 500,
  });

  if (response.status >= 400) {
    const error = new Error('HF_INFERENCE_ERROR');
    error.status = response.status;
    error.data = response.data;
    throw error;
  }

  const predictions = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.labels)
      ? response.data.labels
      : [];

  const isTrash = predictions.some(item =>
    trashKeywords.some(keyword =>
      (item.label || '').toLowerCase().includes(keyword)
    )
  );

  return { isTrash };
};

app.post('/api/classify-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  if (!IMAGE_CLASSIFICATION_ENABLED && !MOCK_CLASSIFICATION) {
    return res.status(503).json({ error: 'Image classification is disabled. Configure HUGGINGFACE_API_KEY ou defina MOCK_CLASSIFICATION=true para testes.' });
  }

  try {
    const result = await classifyImageBuffer(req.file);
    res.json(result);
  } catch (error) {
    const status = error.status || error.response?.status || 500;
    const data = error.data || error.response?.data;
    console.error('Error classifying image:', data || error.message);

    let message = 'Failed to classify image';
    if (error.message === 'IMAGE_CLASSIFICATION_DISABLED') {
      message = 'Image classification is disabled.';
    } else if (status === 401 || status === 403) {
      message = 'HuggingFace API key inválida ou sem permissão.';
    } else if (status === 410) {
      message = 'Endpoint antigo depreciado. Atualize HUGGINGFACE_INFERENCE_URL para o roteador oficial.';
    } else if (status === 415) {
      message = 'Formato inválido: envie a imagem como multipart/form-data.';
    }

    res.status(503).json({ error: message, details: data || null });
  }
});


// Admin: Fetch all reports with owner data
app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*, users:users!reports_user_id_fkey(name, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json(data.map((report) => buildReportResponse(report, { includeReporterContact: true })));
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
      .select('*, users:users!reports_user_id_fkey(name, email)')
      .single();

    if (error) throw error;
    res.json(buildReportResponse(data, { includeReporterContact: true }));
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
