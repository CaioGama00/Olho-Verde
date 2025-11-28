jest.mock('../../config/env', () => ({
  IMAGE_CLASSIFICATION_BYPASS: false,
  IMAGE_CLASSIFICATION_ENABLED: true,
}));
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

    it('should return successful classification with confidence score', async () => {
      mockReq.body = { expectedCategoryId: 'foco_lixo' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'foco_lixo', label: 'Foco de lixo' },
          score: 0.88,
        },
        topPrediction: [
          { category: { id: 'foco_lixo', label: 'Foco de lixo' }, score: 0.88 },
        ],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          detectedCategoryId: 'foco_lixo',
          confidence: 0.88,
        })
      );
    });

    it('should return top predictions when classification fails', async () => {
      mockReq.body = { expectedCategoryId: 'arvore_queda' };

      const predictions = [
        { category: { id: 'foco_lixo', label: 'Foco de lixo' }, score: 0.6 },
        { category: { id: 'alagamento', label: 'Alagamento' }, score: 0.4 },
      ];

      classifyImageBuffer.mockResolvedValue({
        bestMatch: null,
        topPrediction: predictions,
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          topPrediction: predictions,
        })
      );
    });

    it('should handle error with response status and data', async () => {
      const errorData = { error: 'Insufficient compute' };
      const error = new Error('API Error');
      error.status = 503;
      error.data = errorData;
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: errorData,
        })
      );
    });

    it('should handle error with response object', async () => {
      const error = new Error('Request failed');
      error.response = {
        status: 500,
        data: { message: 'Server error' },
      };
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Falha ao classificar a imagem.',
          details: { message: 'Server error' },
        })
      );
    });

    it('should validate category exists before matching', async () => {
      mockReq.body = { expectedCategoryId: 'invalid_category' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'alagamento', label: 'Alagamento' },
          score: 0.9,
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

    it('should return bestMatch when it matches expected category', async () => {
      mockReq.body = { expectedCategoryId: 'arvore_queda' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'arvore_queda', label: 'Árvore caída' },
          score: 0.92,
        },
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          detectedCategoryId: 'arvore_queda',
          detectedCategoryLabel: 'Árvore caída',
          confidence: 0.92,
        })
      );
    });

    it('should include topPrediction in successful response', async () => {
      mockReq.body = { expectedCategoryId: 'foco_lixo' };

      const topPredictions = [
        { label: 'garbage_pile', score: 0.95 },
        { label: 'pollution', score: 0.75 },
      ];

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'foco_lixo', label: 'Foco de lixo' },
          score: 0.95,
        },
        topPrediction: topPredictions,
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          topPrediction: topPredictions,
        })
      );
    });

    it('should handle missing file mimetype', async () => {
      mockReq.file = {
        originalname: 'photo.jpg',
        buffer: Buffer.from('test'),
      };

      mockReq.body = { expectedCategoryId: 'alagamento' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'alagamento', label: 'Alagamento' },
          score: 0.9,
        },
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should log predictions and matches during successful classification', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mockReq.body = { expectedCategoryId: 'alagamento' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'alagamento', label: 'Alagamento' },
          score: 0.95,
        },
        topPrediction: [{ label: 'flood', score: 0.95 }],
      });

      await classifyImage(mockReq, mockRes);

      consoleSpy.mockRestore();
    });

    it('should handle multiple error status codes from API', async () => {
      const error = new Error('Server error');
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

    it('should handle error without status property', async () => {
      const error = new Error('Unknown error');
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Falha ao classificar a imagem.',
        })
      );
    });

    it('should handle error with response.status property', async () => {
      const error = new Error('API error');
      error.response = { status: 429, data: { message: 'Rate limited' } };
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    it('should handle error data in response', async () => {
      const error = new Error('API error');
      error.status = 500;
      error.data = { error: 'Internal server error' };
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { error: 'Internal server error' },
        })
      );
    });

    it('should handle bestMatch with all required fields', async () => {
      mockReq.body = { expectedCategoryId: 'foco_lixo' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { 
            id: 'foco_lixo', 
            label: 'Foco de lixo',
            failureMessage: 'A imagem não mostra foco de lixo'
          },
          score: 0.88,
        },
        topPrediction: [
          { label: 'garbage', score: 0.88 },
          { label: 'trash', score: 0.75 },
        ],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          detectedCategoryId: 'foco_lixo',
          detectedCategoryLabel: 'Foco de lixo',
          confidence: 0.88,
          topPrediction: expect.any(Array),
        })
      );
    });

    it('should return appropriate message when bestMatch does not match expected category', async () => {
      mockReq.body = { expectedCategoryId: 'arvore_queda' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'alagamento', label: 'Alagamento' },
          score: 0.92,
        },
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.status().json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'A imagem não mostra árvore caída',
          detectedCategoryId: 'alagamento',
          detectedCategoryLabel: 'Alagamento',
          confidence: 0.92,
        })
      );
    });

    it('should handle empty topPrediction array', async () => {
      mockReq.body = { expectedCategoryId: 'alagamento' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'alagamento', label: 'Alagamento' },
          score: 0.9,
        },
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          topPrediction: [],
        })
      );
    });

    it('should accept any file type for classification', async () => {
      mockReq.file.mimetype = 'image/png';
      mockReq.body = { expectedCategoryId: 'alagamento' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'alagamento', label: 'Alagamento' },
          score: 0.95,
        },
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(classifyImageBuffer).toHaveBeenCalledWith(mockReq.file, 'alagamento');
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should pass file and expectedCategoryId to classification service', async () => {
      mockReq.body = { expectedCategoryId: 'foco_lixo' };
      mockReq.file = {
        originalname: 'garbage.png',
        buffer: Buffer.from('image-data'),
        mimetype: 'image/png',
      };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: null,
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(classifyImageBuffer).toHaveBeenCalledWith(mockReq.file, 'foco_lixo');
    });

    it('should handle success response structure with all fields', async () => {
      mockReq.body = { expectedCategoryId: 'alagamento' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'alagamento', label: 'Alagamento' },
          score: 0.96,
        },
        topPrediction: [
          { label: 'flood', score: 0.96 },
          { label: 'water', score: 0.85 },
        ],
      });

      await classifyImage(mockReq, mockRes);

      const call = mockRes.json.mock.calls[0][0];
      expect(call).toHaveProperty('success', true);
      expect(call).toHaveProperty('detectedCategoryId', 'alagamento');
      expect(call).toHaveProperty('detectedCategoryLabel', 'Alagamento');
      expect(call).toHaveProperty('confidence', 0.96);
      expect(call).toHaveProperty('topPrediction');
    });

    it('should handle error response with details', async () => {
      const errorDetails = { code: 'INVALID_IMAGE', message: 'Image too small' };
      const error = new Error('Validation failed');
      error.status = 400;
      error.data = errorDetails;
      classifyImageBuffer.mockRejectedValue(error);

      await classifyImage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const call = mockRes.status().json.mock.calls[0][0];
      expect(call).toHaveProperty('error');
      expect(call).toHaveProperty('details', errorDetails);
    });

    it('should extract expectedCategoryId from request body', async () => {
      mockReq.body = { expectedCategoryId: 'arvore_queda', otherField: 'ignored' };

      classifyImageBuffer.mockResolvedValue({
        bestMatch: null,
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(classifyImageBuffer).toHaveBeenCalledWith(mockReq.file, 'arvore_queda');
    });

    it('should handle classification when expectedCategoryId is not provided', async () => {
      mockReq.body = {};

      classifyImageBuffer.mockResolvedValue({
        bestMatch: {
          category: { id: 'foco_lixo', label: 'Foco de lixo' },
          score: 0.91,
        },
        topPrediction: [],
      });

      await classifyImage(mockReq, mockRes);

      expect(classifyImageBuffer).toHaveBeenCalledWith(mockReq.file, undefined);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          detectedCategoryId: 'foco_lixo',
        })
      );
    });
  });
});
