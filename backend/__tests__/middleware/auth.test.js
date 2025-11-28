const {
  authenticateToken,
  requireAdmin,
  getUserFromRequest,
  isAdminUser,
} = require('../../middleware/auth');
const supabase = require('../../db');

jest.mock('../../db');
jest.mock('../../config/env', () => ({
  ADMIN_EMAILS: new Set(['admin@example.com']),
}));

describe('Auth Middleware', () => {
  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    user_metadata: { name: 'User' },
  };

  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    user_metadata: { name: 'Admin' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAdminUser', () => {
    it('should return true when user has admin flag in user_metadata', () => {
      const userWithAdminFlag = {
        ...mockAdminUser,
        user_metadata: { is_admin: true },
      };

      const result = isAdminUser(userWithAdminFlag);
      expect(result).toBe(true);
    });

    it('should return true when user has admin role in user_metadata', () => {
      const userWithAdminRole = {
        ...mockAdminUser,
        user_metadata: { role: 'admin' },
      };

      const result = isAdminUser(userWithAdminRole);
      expect(result).toBe(true);
    });

    it('should return true when user email is in ADMIN_EMAILS', () => {
      const result = isAdminUser(mockAdminUser);
      expect(result).toBe(true);
    });

    it('should return false when user is not admin', () => {
      const result = isAdminUser(mockUser);
      expect(result).toBe(false);
    });

    it('should return false when user is null', () => {
      const result = isAdminUser(null);
      expect(result).toBe(false);
    });

    it('should handle roles array', () => {
      const userWithRolesArray = {
        ...mockUser,
        app_metadata: { roles: ['user', 'admin'] },
      };

      const result = isAdminUser(userWithRolesArray);
      expect(result).toBe(true);
    });

    it('should be case insensitive for role comparison', () => {
      const userWithUppercaseRole = {
        ...mockUser,
        user_metadata: { role: 'ADMIN' },
      };

      const result = isAdminUser(userWithUppercaseRole);
      expect(result).toBe(true);
    });
  });

  describe('getUserFromRequest', () => {
    it('should return null when no authorization header', async () => {
      const req = { headers: {} };

      const result = await getUserFromRequest(req);

      expect(result).toBeNull();
    });

    it('should extract token from Bearer authorization header', async () => {
      const token = 'valid-token-123';
      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      };

      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await getUserFromRequest(req);

      expect(result).toEqual(mockUser);
      expect(supabase.auth.getUser).toHaveBeenCalledWith(token);
    });

    it('should return null when token is invalid', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      };

      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token'),
      });

      const result = await getUserFromRequest(req);

      expect(result).toBeNull();
    });
  });

  describe('authenticateToken middleware', () => {
    it('should return 401 when no token provided', async () => {
      const req = { headers: {} };
      const res = {
        sendStatus: jest.fn(),
      };
      const next = jest.fn();

      await authenticateToken(req, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should set user on request when token is valid', async () => {
      const req = {
        headers: {
          authorization: 'Bearer valid-token',
        },
      };
      const res = {};
      const next = jest.fn();

      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authenticateToken(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should set isAdmin flag correctly', async () => {
      const req = {
        headers: {
          authorization: 'Bearer valid-token',
        },
      };
      const res = {};
      const next = jest.fn();

      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockAdminUser },
        error: null,
      });

      await authenticateToken(req, res, next);

      expect(req.isAdmin).toBe(true);
    });

    it('should return 401 when token is invalid', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      };
      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };
      const next = jest.fn();

      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token'),
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin middleware', () => {
    it('should call next when user is admin', () => {
      const req = { isAdmin: true };
      const res = {};
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user is not admin', () => {
      const req = { isAdmin: false };
      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
