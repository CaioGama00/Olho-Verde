require('dotenv').config();

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

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = (process.env.HUGGINGFACE_MODEL || 'microsoft/resnet-50').trim();
const HUGGINGFACE_INFERENCE_URL = (process.env.HUGGINGFACE_INFERENCE_URL || `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`).trim();
const IMAGE_CLASSIFICATION_BYPASS = process.env.IMAGE_CLASSIFICATION_BYPASS === 'true';
const IMAGE_CLASSIFICATION_ENABLED = IMAGE_CLASSIFICATION_BYPASS || Boolean(HUGGINGFACE_API_KEY);

const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'report-images';

const PORT = process.env.PORT || 3001;

// Log warnings
if (!IMAGE_CLASSIFICATION_ENABLED) {
    console.warn('HUGGINGFACE_API_KEY não definido. /api/classify-image ficará desabilitado.');
} else if (IMAGE_CLASSIFICATION_BYPASS) {
    console.warn('IMAGE_CLASSIFICATION_BYPASS=true: classificação será sempre aprovada.');
}

module.exports = {
    PORT,
    FRONTEND_BASE_URL,
    PASSWORD_RESET_REDIRECT_URL,
    ADMIN_EMAILS,
    HUGGINGFACE_API_KEY,
    HUGGINGFACE_MODEL,
    HUGGINGFACE_INFERENCE_URL,
    IMAGE_CLASSIFICATION_BYPASS,
    IMAGE_CLASSIFICATION_ENABLED,
    SUPABASE_STORAGE_BUCKET,
};
