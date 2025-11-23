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

module.exports = {
    REPORT_STATUSES,
    DEFAULT_REPORT_STATUS,
    REPORT_CATEGORIES,
    CATEGORY_DEFAULT_THRESHOLD,
};
