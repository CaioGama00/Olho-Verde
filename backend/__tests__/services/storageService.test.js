jest.mock('../../db');
jest.mock('../../config/env', () => ({
  SUPABASE_STORAGE_BUCKET: 'test-bucket',
}));

const { uploadImageToStorage } = require('../../services/storageService');
const supabase = require('../../db');

describe('StorageService', () => {
  const mockUserId = 'user-123';
  const mockFile = {
    originalname: 'photo.jpg',
    buffer: Buffer.from('test'),
    mimetype: 'image/jpeg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadImageToStorage', () => {
    it('should return null when file is not provided', async () => {
      const result = await uploadImageToStorage(null, mockUserId);
      expect(result).toBeNull();
    });

    it('should upload file and return fileId and publicUrl', async () => {
      const mockPath = 'user-123/1234567890-abc123.jpg';
      const mockPublicUrl = 'https://bucket.supabase.co/storage/v1/object/public/path';

      supabase.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: mockPath },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: mockPublicUrl },
        }),
      });

      const result = await uploadImageToStorage(mockFile, mockUserId);

      expect(result).toEqual({
        fileId: mockPath,
        publicUrl: mockPublicUrl,
      });
    });

    it('should handle file without extension', async () => {
      const fileWithoutExt = { ...mockFile, originalname: 'photo' };
      const mockPath = 'user-123/1234567890-abc123.jpg';

      supabase.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: mockPath },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://url.com' },
        }),
      });

      const result = await uploadImageToStorage(fileWithoutExt, mockUserId);

      expect(result).toBeDefined();
      expect(result.fileId).toBe(mockPath);
    });

    it('should use anon for userId when not provided', async () => {
      const mockPath = 'anon/1234567890-abc123.jpg';

      supabase.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: mockPath },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://url.com' },
        }),
      });

      const result = await uploadImageToStorage(mockFile, null);

      expect(result.fileId).toContain('anon/');
    });

    it('should throw error when upload fails', async () => {
      const uploadError = new Error('Upload failed');

      supabase.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: uploadError,
        }),
      });

      await expect(uploadImageToStorage(mockFile, mockUserId)).rejects.toThrow(
        uploadError
      );
    });

    it('should handle missing publicUrl gracefully', async () => {
      const mockPath = 'user-123/1234567890-abc123.jpg';

      supabase.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: mockPath },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: {},
        }),
      });

      const result = await uploadImageToStorage(mockFile, mockUserId);

      expect(result.publicUrl).toBeNull();
    });
  });
});
