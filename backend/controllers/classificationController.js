const {
    IMAGE_CLASSIFICATION_BYPASS,
    IMAGE_CLASSIFICATION_ENABLED,
} = require('../config/env');
const { REPORT_CATEGORIES } = require('../config/constants');
const { classifyImageBuffer } = require('../services/classificationService');

// POST /api/classify-image
const classifyImage = async (req, res) => {
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
};

module.exports = {
    classifyImage,
};
