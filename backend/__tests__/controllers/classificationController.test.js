jest.mock('../../config/env');
jest.mock('../../services/classificationService');
jest.mock('../../config/constants', () => ({
  REPORT_CATEGORIES: [
    {
      id: 'alagamento',
      label: 'Alagamento',
      failureMessage: 'A imagem não mostra alagamento',
    },
    {
      id: 'foco_lixo',
      label: 'Foco de lixo',
      failureMessage: 'A imagem não mostra foco de lixo',
    },
    {
      id: 'arvore_queda',
      label: 'Árvore caída',
      failureMessage: 'A imagem não mostra árvore caída',
    },
  ],
}));

const { classifyImage } = require('../../controllers/classificationController');
const { classifyImageBuffer } = require('../../services/classificationService');

describe('ClassificationController', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      file: {
        originalname: 'photo.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      },
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnValue({
        json: jest.fn().mockReturnValue(mockRes),
      }),
      json: jest.fn().mockReturnValue(mockRes),
    };

    jest.clearAllMocks();
  });

  describe('classifyImage', () => {
    it('should return error when no file is provided', async () => {
      mockReq.file = null;

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.status().json).toHaveBeenCalledWith({
        error: 'Nenhuma imagem foi enviada.',
      });
    });



    it('should classify image successfully with matching category', async () => {
      mockReq.body = { expectedCategoryId: 'alagamento' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'alagamento', label: 'Alagamento' },
          score: 0.95,
        },
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          detectedCategoryId: 'alagamento',
          detectedCategoryLabel: 'Alagamento',
          confidence: 0.95,
        })
      );
    });

    it('should return error when no match found', async () => {
      mockReq.body = { expectedCategoryId: 'alagamento' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: null,
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'A imagem não mostra alagamento',
        })
      );
    });

    it('should return error when detected category differs from expected', async () => {
      mockReq.body = { expectedCategoryId: 'alagamento' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'foco_lixo', label: 'Foco de lixo' },
          score: 0.85,
        },
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'A imagem não mostra alagamento',
          detectedCategoryId: 'foco_lixo',
        })
      );
    });

    it('should handle classification service error', async () => {
      const error = new Error('Classification service error');
      error.status = 500;
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Falha ao classificar a imagem.',
        })
      );
    });

    it('should handle invalid API key error', async () => {
      const error = new Error('Invalid API key');
      error.status = 401;
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'HuggingFace API key inválida ou sem permissão.',
        })
      );
    });

    it('should handle forbidden API error', async () => {
      const error = new Error('Forbidden');
      error.status = 403;
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'HuggingFace API key inválida ou sem permissão.',
        })
      );
    });

    it('should return generic error message when classification is disabled exception', async () => {
      const error = new Error('IMAGE_CLASSIFICATION_DISABLED');
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Classificação desativada.',
        })
      );
    });

    it('should include topPrediction when classification fails', async () => {
      mockReq.body = { expectedCategoryId: 'alagamento' };

      const topPredictions = [
        { category: { id: 'foco_lixo', label: 'Foco de lixo' }, score: 0.7 },
        { category: { id: 'arvore_queda', label: 'Árvore caída' }, score: 0.2 },
      ];

      classifyImageBuffer.mockResolvedValue({
        bestMatch: null,
        topPrediction: topPredictions,
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          topPrediction: topPredictions,
        })
      );
    });

    it('should use default failure message when category not found', async () => {
      mockReq.body = { expectedCategoryId: 'invalid_category' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: null,
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Não conseguimos identificar o problema na imagem. Envie outra foto com mais detalhes.',
        })
      );
    });

    it('should classify without expected category when not provided', async () => {
      mockReq.body = {};

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'alagamento', label: 'Alagamento' },
          score: 0.92,
        },
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          detectedCategoryId: 'alagamento',
        })
      );
    });
  });
});
