jest.mock('axios');
jest.mock('../../config/env', () => ({
  IMAGE_CLASSIFICATION_ENABLED: true,
  IMAGE_CLASSIFICATION_BYPASS: false,
  HUGGINGFACE_API_KEY: 'test-api-key',
  HUGGINGFACE_INFERENCE_URL: 'https://api.huggingface.co/test',
}));
jest.mock('../../config/constants', () => ({
  REPORT_CATEGORIES: [
    {
      id: 'alagamento',
      label: 'Alagamento',
      keywords: ['flood', 'water', 'inundacao'],
      threshold: 0.5,
    },
    {
      id: 'foco_lixo',
      label: 'Foco de lixo',
      keywords: ['garbage', 'lixo', 'trash', 'waste'],
      threshold: 0.5,
    },
    {
      id: 'arvore_queda',
      label: 'Árvore caída',
      keywords: ['tree', 'fallen', 'arvore', 'queda'],
      threshold: 0.6,
    },
  ],
  CATEGORY_DEFAULT_THRESHOLD: 0.5,
}));

const axios = require('axios');
const { classifyImageBuffer } = require('../../services/classificationService');

describe('ClassificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyImageBuffer', () => {

    it('should classify image successfully with exact category match', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      axios.post.mockResolvedValue({
        data: [
          { label: 'flood_damage', score: 0.95 },
          { label: 'garbage_pile', score: 0.3 },
        ],
      });

      const result = await classifyImageBuffer(file, 'alagamento');

      expect(result.bestMatch).toBeDefined();
      expect(result.bestMatch.category.id).toBe('alagamento');
      expect(result.bestMatch.score).toBe(0.95);
      expect(result.topPrediction).toEqual({ label: 'flood_damage', score: 0.95 });
    });

    it('should classify image without expected category', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      axios.post.mockResolvedValue({
        data: [
          { label: 'garbage', score: 0.9 },
          { label: 'flood', score: 0.5 },
        ],
      });

      const result = await classifyImageBuffer(file);

      expect(result.bestMatch).toBeDefined();
      expect(result.bestMatch.category.id).toBe('foco_lixo');
      expect(result.bestMatch.score).toBe(0.9);
    });

    it('should return null bestMatch when no predictions meet threshold', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      axios.post.mockResolvedValue({
        data: [
          { label: 'random_object', score: 0.2 },
          { label: 'unknown_thing', score: 0.15 },
        ],
      });

      const result = await classifyImageBuffer(file);

      expect(result.bestMatch).toBeNull();
      expect(result.topPrediction).toEqual({ label: 'random_object', score: 0.2 });
    });

    it('should respect category-specific thresholds', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      axios.post.mockResolvedValue({
        data: [
          { label: 'fallen_tree', score: 0.55 },
        ],
      });

      const result = await classifyImageBuffer(file);

      expect(result.bestMatch).toBeNull();
      expect(result.topPrediction).toEqual({ label: 'fallen_tree', score: 0.55 });
    });

    it('should pass correct headers to API', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/png',
      };

      axios.post.mockResolvedValue({
        data: [{ label: 'garbage', score: 0.9 }],
      });

      await classifyImageBuffer(file);

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.huggingface.co/test',
        Buffer.from('test-image-data'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            Accept: 'application/json',
            'Content-Type': 'image/png',
          }),
          responseType: 'json',
          timeout: 60000,
        })
      );
    });

    it('should use default mimetype when not provided', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
      };

      axios.post.mockResolvedValue({
        data: [{ label: 'garbage', score: 0.9 }],
      });

      await classifyImageBuffer(file);

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream',
          }),
        })
      );
    });

    it('should handle API returning non-array response', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      axios.post.mockResolvedValue({
        data: { error: 'Invalid request' },
      });

      const result = await classifyImageBuffer(file);

      expect(result.bestMatch).toBeNull();
      expect(result.topPrediction).toBeNull();
    });

    it('should handle empty predictions array', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      axios.post.mockResolvedValue({
        data: [],
      });

      const result = await classifyImageBuffer(file);

      expect(result.bestMatch).toBeNull();
      expect(result.topPrediction).toBeNull();
    });

    it('should handle axios request error', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      const apiError = new Error('Network error');
      apiError.response = { data: { error: 'Connection failed' } };
      axios.post.mockRejectedValue(apiError);

      await expect(classifyImageBuffer(file)).rejects.toThrow('HF_INFERENCE_ERROR');
    });

    it('should preserve error data in thrown error', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      const errorData = { error: 'API rate limited' };
      const apiError = new Error('Rate limit exceeded');
      apiError.response = { data: errorData };
      axios.post.mockRejectedValue(apiError);

      try {
        await classifyImageBuffer(file);
      } catch (error) {
        expect(error.data).toEqual(errorData);
      }
    });

    it('should handle predictions with missing scores', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      axios.post.mockResolvedValue({
        data: [
          { label: 'random_label' },
          { label: 'dog', score: 0.8 },
        ],
      });

      const result = await classifyImageBuffer(file);

      expect(result.bestMatch).toBeNull();
    });

    it('should use default threshold when category has no threshold', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      axios.post.mockResolvedValue({
        data: [{ label: 'random_label', score: 0.55 }],
      });

      const result = await classifyImageBuffer(file);

      expect(result.bestMatch).toBeNull();
    });

    it('should handle large number of predictions', async () => {
      const file = {
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg',
      };

      const predictions = Array.from({ length: 1000 }, (_, i) => ({
        label: `prediction_${i}`,
        score: Math.random() * 0.2,
      }));
      predictions.unshift({ label: 'flood', score: 0.95 });

      axios.post.mockResolvedValue({ data: predictions });

      const result = await classifyImageBuffer(file);

      expect(result.topPrediction.label).toBe('flood');
      expect(result.topPrediction.score).toBe(0.95);
    });
  });
});
