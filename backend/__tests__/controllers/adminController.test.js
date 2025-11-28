const {
  getAllReports,
  updateReportStatus,
  moderateReport,
  listUsers,
  toggleUserBlock,
} = require('../../controllers/adminController');
const supabase = require('../../db');

jest.mock('../../db');
jest.mock('../../config/constants', () => ({
  REPORT_STATUSES: ['nova', 'em_analise', 'resolvida'],
}));
jest.mock('../../utils/reportHelpers', () => ({
  buildReportResponse: jest.fn((report) => ({
    id: report.id,
    problem: report.problem,
    status: report.status,
    moderation_status: report.moderation_status,
    user_id: report.user_id,
    created_at: report.created_at,
  })),
}));
jest.mock('../../utils/userProfile', () => ({
  fetchUserProfilesByIds: jest.fn(() => new Map()),
}));

describe('AdminController', () => {
  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
  };

  const mockReport = {
    id: 1,
    user_id: 'user-123',
    problem: 'alagamento',
    status: 'nova',
    moderation_status: 'pendente',
    created_at: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllReports', () => {
    it('should return all reports', async () => {
      const req = { user: mockAdminUser };
      const res = {
        json: jest.fn(),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [mockReport],
            error: null,
          }),
        }),
      });

      await getAllReports(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should handle database error', async () => {
      const req = { user: mockAdminUser };
      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error'),
          }),
        }),
      });

      await getAllReports(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateReportStatus', () => {
    it('should update report status', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: '1' },
        body: { status: 'resolvida' },
      };

      const res = {
        json: jest.fn(),
      };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { ...mockReport, status: 'resolvida' },
                error: null,
              }),
            }),
          }),
        }),
      });

      await updateReportStatus(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return error for invalid status', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: '1' },
        body: { status: 'invalid_status' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await updateReportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when report not found', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: '999' },
        body: { status: 'resolvida' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      await updateReportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('moderateReport', () => {
    it('should approve report', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: '1' },
        body: { action: 'approve', reason: 'Foto clara e localização precisa' },
      };

      const res = {
        json: jest.fn(),
      };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  ...mockReport,
                  moderation_status: 'aprovado',
                  moderated_by: mockAdminUser.id,
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      await moderateReport(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject report', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: '1' },
        body: { action: 'reject', reason: 'Imagem não clara' },
      };

      const res = {
        json: jest.fn(),
      };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  ...mockReport,
                  moderation_status: 'rejeitado',
                  moderated_by: mockAdminUser.id,
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      await moderateReport(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return error for invalid action', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: '1' },
        body: { action: 'invalid', reason: 'reason' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await moderateReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return error when reason is missing', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: '1' },
        body: { action: 'approve', reason: '' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await moderateReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return error when reason exceeds limit', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: '1' },
        body: {
          action: 'reject',
          reason: 'a'.repeat(501),
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await moderateReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when report not found', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: '999' },
        body: { action: 'approve', reason: 'Good report' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      await moderateReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listUsers', () => {
    it('should return list of users', async () => {
      const req = { user: mockAdminUser };
      const res = {
        json: jest.fn(),
      };

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          user_metadata: { name: 'User 1' },
          created_at: '2024-01-01T00:00:00Z',
          last_sign_in_at: '2024-01-15T10:00:00Z',
        },
      ];

      supabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      });

      await listUsers(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'user-1',
            email: 'user1@example.com',
          }),
        ])
      );
    });

    it('should handle auth error', async () => {
      const req = { user: mockAdminUser };
      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.auth.admin.listUsers.mockResolvedValue({
        data: null,
        error: new Error('Auth error'),
      });

      await listUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('toggleUserBlock', () => {
    it('should block user', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: 'user-123' },
        body: { block: true },
      };

      const res = {
        json: jest.fn(),
      };

      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: { id: 'user-123', banned_until: 'forever' } },
        error: null,
      });

      await toggleUserBlock(req, res);

      expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          ban_duration: 'forever',
        })
      );
    });

    it('should unblock user', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: 'user-123' },
        body: { block: false },
      };

      const res = {
        json: jest.fn(),
      };

      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      await toggleUserBlock(req, res);

      expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          ban_duration: 'none',
        })
      );
    });

    it('should return error for non-boolean block value', async () => {
      const req = {
        user: mockAdminUser,
        params: { id: 'user-123' },
        body: { block: 'invalid' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await toggleUserBlock(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
