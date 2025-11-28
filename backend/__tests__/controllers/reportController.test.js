const {
  getAllReports,
  createReport,
  voteOnReport,
  addComment,
  getReportById,
  getReportComments,
} = require('../../controllers/reportController');
const supabase = require('../../db');
const { uploadImageToStorage } = require('../../services/storageService');
const { getUserFromRequest } = require('../../middleware/auth');

jest.mock('../../db');
jest.mock('../../middleware/auth');
jest.mock('../../services/storageService');
jest.mock('../../config/constants', () => ({
  DEFAULT_REPORT_STATUS: 'nova',
}));
jest.mock('../../config/env', () => ({
  SUPABASE_STORAGE_BUCKET: 'test-bucket',
}));
jest.mock('../../utils/reportHelpers', () => ({
  buildReportResponse: jest.fn((report) => ({
    id: report.id,
    problem: report.problem,
    description: report.description,
    latitude: report.lat,
    longitude: report.lng,
    image_url: report.image_url,
    votes: (report.upvotes || 0) - (report.downvotes || 0),
    moderation_status: report.moderation_status,
    created_at: report.created_at,
  })),
}));
jest.mock('../../utils/userProfile', () => ({
  extractUserProfile: jest.fn((user) => ({
    name: user.user_metadata?.name || null,
    email: user.email,
  })),
}));

describe('ReportController', () => {
  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    user_metadata: { name: 'John Doe' },
  };

  const mockReport = {
    id: 1,
    user_id: 'user-123',
    problem: 'alagamento',
    description: 'Rua alagada',
    lat: -23.5505,
    lng: -46.6333,
    image_url: 'https://example.com/image.jpg',
    upvotes: 0,
    downvotes: 0,
    moderation_status: 'nova',
    created_at: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllReports', () => {
    it('should return all approved reports', async () => {
      const req = { headers: {} };
      const res = {
        json: jest.fn(),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockReport],
              error: null,
            }),
          }),
        }),
      });

      getUserFromRequest.mockResolvedValue(null);

      await getAllReports(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should include user votes when authenticated', async () => {
      const req = { headers: { authorization: 'Bearer token' } };
      const res = {
        json: jest.fn(),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockReport],
              error: null,
            }),
          }),
        }),
      });

      getUserFromRequest.mockResolvedValue(mockUser);

      await getAllReports(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should handle database error', async () => {
      const req = { headers: {} };
      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      });

      getUserFromRequest.mockResolvedValue(null);

      await getAllReports(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createReport', () => {
    it('should create a new report with image', async () => {
      const mockFile = {
        originalname: 'photo.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      };

      const req = {
        user: mockUser,
        file: mockFile,
        body: {
          problem: 'alagamento',
          description: 'Rua alagada',
          lat: -23.5505,
          lng: -46.6333,
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      uploadImageToStorage.mockResolvedValue({
        fileId: 'file-123',
        publicUrl: 'https://example.com/image.jpg',
      });

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [mockReport],
            error: null,
          }),
        }),
      });

      await createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should create report without image', async () => {
      const req = {
        user: mockUser,
        file: null,
        body: {
          problem: 'alagamento',
          description: 'Rua alagada',
          lat: -23.5505,
          lng: -46.6333,
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [{ ...mockReport, image_url: null }],
            error: null,
          }),
        }),
      });

      await createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return error when required fields are missing', async () => {
      const req = {
        user: mockUser,
        file: null,
        body: {
          description: 'Rua alagada',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle invalid coordinates', async () => {
      const req = {
        user: mockUser,
        file: null,
        body: {
          problem: 'alagamento',
          description: 'Rua alagada',
          lat: 'invalid',
          lng: -46.6333,
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle image upload error', async () => {
      const mockFile = {
        originalname: 'photo.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      };

      const req = {
        user: mockUser,
        file: mockFile,
        body: {
          problem: 'alagamento',
          description: 'Rua alagada',
          lat: -23.5505,
          lng: -46.6333,
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      uploadImageToStorage.mockRejectedValue(
        new Error('Upload failed')
      );

      await createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

    it('should add upvote to report', async () => {
      const req = {
        user: mockUser,
        params: { id: '1' },
        body: { vote: 'up' },
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const mockSelectChain = {
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { upvotes: 0, downvotes: 0 },
            error: null,
          }),
        }),
      };

      const mockVoteSelectChain = {
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      };

      supabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectChain),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockVoteSelectChain),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        });

      await voteOnReport(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          upvotes: 1,
          user_vote: 'up',
        })
      );
    });

    it('should return error for invalid vote type', async () => {
      const req = {
        user: mockUser,
        params: { id: '1' },
        body: { vote: 'invalid' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await voteOnReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

  describe('addComment', () => {
    it('should add comment to report', async () => {
      const req = {
        user: mockUser,
        params: { id: '1' },
        body: { content: 'Great report!' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
        json: jest.fn(),
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'comment-1',
                content: 'Great report!',
                created_at: '2024-01-15T10:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      await addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return error when comment is empty', async () => {
      const req = {
        user: mockUser,
        params: { id: '1' },
        body: { content: '' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return error for invalid report ID', async () => {
      const req = {
        user: mockUser,
        params: { id: 'invalid' },
        body: { content: 'Great report!' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getReportById', () => {
    it('should return report with comments and user vote', async () => {
      const req = {
        user: mockUser,
        params: { id: '1' },
        headers: { authorization: 'Bearer token' },
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const mockSelectChain = {
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockReport,
              error: null,
            }),
          }),
        }),
      };

      supabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectChain),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        });

      getUserFromRequest.mockResolvedValue(mockUser);

      await getReportById(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 when report not found', async () => {
      const req = {
        user: mockUser,
        params: { id: '999' },
        headers: {},
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      getUserFromRequest.mockResolvedValue(null);

      await getReportById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getReportComments', () => {
    it('should return report comments', async () => {
      const req = {
        params: { id: '1' },
      };

      const res = {
        json: jest.fn(),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'comment-1',
                  content: 'Great report!',
                  created_at: '2024-01-15T10:00:00Z',
                  user_id: 'user-123',
                  users: { name: 'John', email: 'john@example.com' },
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      await getReportComments(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return error for invalid report ID', async () => {
      const req = {
        params: { id: 'invalid' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await getReportComments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
