const axios = require('axios');
const {
    HUGGINGFACE_API_KEY,
    HUGGINGFACE_INFERENCE_URL,
    IMAGE_CLASSIFICATION_ENABLED,
    IMAGE_CLASSIFICATION_BYPASS,
} = require('../config/env');
const {
    REPORT_CATEGORIES,
    CATEGORY_DEFAULT_THRESHOLD,
} = require('../config/constants');

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

module.exports = {
    classifyImageBuffer,
};
