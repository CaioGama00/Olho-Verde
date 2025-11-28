const {
  register,
  login,
  updateProfile,
  requestPasswordReset,
  confirmPasswordReset,
} = require('../../controllers/authController');
const supabase = require('../../db');

jest.mock('../../db');
jest.mock('../../middleware/auth', () => ({
  isAdminUser: jest.fn(() => false),
}));
jest.mock('../../config/env', () => ({
  PASSWORD_RESET_REDIRECT_URL: 'https://example.com/reset',
}));

describe('AuthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'john@example.com',
        identities: [{ id: 'identity-1' }],
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'password123',
        options: {
          data: { name: 'John Doe' },
        },
      });
    });

    it('should return error when email already exists', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'existing@example.com',
          password: 'password123',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'existing@example.com',
        identities: [],
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle supabase error', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Supabase error');
      supabase.auth.signUp.mockResolvedValue({
        data: null,
        error,
      });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password123',
        },
      };

      const mockSession = {
        access_token: 'token-123',
        refresh_token: 'refresh-123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
      };

      const res = {
        json: jest.fn(),
      };

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: mockSession,
          user: mockUser,
        },
        error: null,
      });

      await login(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'token-123',
          refreshToken: 'refresh-123',
          user: mockUser,
        })
      );
    });

    it('should return error for invalid credentials', async () => {
      const req = {
        body: {
          email: 'user@example.com',
          password: 'wrongpassword',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Invalid credentials');
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error,
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should include isAdmin flag in response', async () => {
      const { isAdminUser } = require('../../middleware/auth');
      isAdminUser.mockReturnValue(true);

      const req = {
        body: {
          email: 'admin@example.com',
          password: 'password123',
        },
      };

      const mockSession = {
        access_token: 'token-123',
        refresh_token: 'refresh-123',
      };

      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com',
      };

      const res = {
        json: jest.fn(),
      };

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: mockSession,
          user: mockUser,
        },
        error: null,
      });

      await login(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isAdmin: true,
        })
      );
    });
  });

  describe('updateProfile', () => {
    it('should update user profile with name only', async () => {
      const req = {
        user: { id: 'user-123' },
        body: {
          name: 'Updated Name',
          password: '',
        },
      };

      const res = {
        json: jest.fn(),
      };

      const mockUpdatedUser = {
        id: 'user-123',
        email: 'user@example.com',
      };

      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: mockUpdatedUser },
        error: null,
      });

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      await updateProfile(req, res);

      expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          user_metadata: { name: 'Updated Name' },
        })
      );
    });

    it('should update user profile with password', async () => {
      const req = {
        user: { id: 'user-123' },
        body: {
          name: 'Updated Name',
          password: 'newpassword123',
        },
      };

      const res = {
        json: jest.fn(),
      };

      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      await updateProfile(req, res);

      expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          password: 'newpassword123',
        })
      );
    });

    it('should handle update error', async () => {
      const req = {
        user: { id: 'user-123' },
        body: {
          name: 'Updated Name',
          password: '',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Update failed');
      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error,
      });

      await updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('requestPasswordReset', () => {
    it('should request password reset successfully', async () => {
      const req = {
        body: {
          email: 'user@example.com',
        },
      };

      const res = {
        json: jest.fn(),
      };

      supabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      await requestPasswordReset(req, res);

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(Object)
      );
    });

    it('should return error when email is missing', async () => {
      const req = {
        body: {},
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await requestPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle reset error', async () => {
      const req = {
        body: {
          email: 'user@example.com',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Email not found');
      supabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error,
      });

      await requestPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('confirmPasswordReset', () => {
    it('should confirm password reset successfully', async () => {
      const req = {
        body: {
          accessToken: 'valid-token-123',
          newPassword: 'newPassword456',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
        json: jest.fn(),
      };

      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await confirmPasswordReset(req, res);

      expect(supabase.auth.getUser).toHaveBeenCalledWith('valid-token-123');
      expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith('user-123', {
        password: 'newPassword456',
      });
      expect(res.json).toHaveBeenCalledWith({
        message: 'Senha atualizada com sucesso. Faça login novamente.',
      });
    });

    it('should return error when accessToken is missing', async () => {
      const req = {
        body: {
          newPassword: 'newPassword456',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await confirmPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.status().json).toHaveBeenCalledWith({
        message: 'Token e nova senha são obrigatórios.',
      });
    });

    it('should return error when newPassword is missing', async () => {
      const req = {
        body: {
          accessToken: 'valid-token-123',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      await confirmPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.status().json).toHaveBeenCalledWith({
        message: 'Token e nova senha são obrigatórios.',
      });
    });

    it('should return error when token is invalid', async () => {
      const req = {
        body: {
          accessToken: 'invalid-token',
          newPassword: 'newPassword456',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await confirmPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.status().json).toHaveBeenCalledWith({
        message: 'Token inválido ou expirado.',
      });
    });

    it('should return error when getUser throws error', async () => {
      const req = {
        body: {
          accessToken: 'bad-token',
          newPassword: 'newPassword456',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Token verification failed');
      supabase.auth.getUser.mockResolvedValue({
        data: null,
        error,
      });

      await confirmPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return error when updateUserById fails', async () => {
      const req = {
        body: {
          accessToken: 'valid-token-123',
          newPassword: 'newPassword456',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const updateError = new Error('Password update failed');
      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error: updateError,
      });

      await confirmPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle exception during password reset', async () => {
      const req = {
        body: {
          accessToken: 'valid-token-123',
          newPassword: 'newPassword456',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Unexpected error');
      supabase.auth.getUser.mockRejectedValue(error);

      await confirmPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('register edge cases', () => {
    it('should handle network error during registration', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Network error');
      supabase.auth.signUp.mockRejectedValue(error);

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.status().json).toHaveBeenCalledWith({
        message: 'Network error',
      });
    });

    it('should handle invalid email format', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'invalid-email',
          password: 'password123',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Invalid email format');
      supabase.auth.signUp.mockResolvedValue({
        data: null,
        error,
      });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('login edge cases', () => {
    it('should return isAdmin true when user is admin', async () => {
      const req = {
        body: {
          email: 'admin@example.com',
          password: 'password123',
        },
      };

      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com',
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
        json: jest.fn(),
      };

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'token-123',
            refresh_token: 'refresh-token-123',
          },
          user: mockUser,
        },
        error: null,
      });

      const { isAdminUser } = require('../../middleware/auth');
      isAdminUser.mockReturnValue(true);

      await login(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isAdmin: true,
        })
      );
    });

    it('should handle login with wrong password', async () => {
      const req = {
        body: {
          email: 'user@example.com',
          password: 'wrongpassword',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Invalid login credentials');
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error,
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateProfile edge cases', () => {
    it('should update profile without password change', async () => {
      const req = {
        body: {
          name: 'Jane Doe',
        },
        user: {
          id: 'user-123',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'jane@example.com',
        user_metadata: { name: 'Jane Doe' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
        json: jest.fn(),
      };

      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      await updateProfile(req, res);

      expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith('user-123', {
        user_metadata: { name: 'Jane Doe' },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Perfil atualizado com sucesso.',
        })
      );
    });

    it('should update profile with password change', async () => {
      const req = {
        body: {
          name: 'Jane Doe',
          password: 'newPassword123',
        },
        user: {
          id: 'user-123',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'jane@example.com',
        user_metadata: { name: 'Jane Doe' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
        json: jest.fn(),
      };

      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      await updateProfile(req, res);

      expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith('user-123', {
        user_metadata: { name: 'Jane Doe' },
        password: 'newPassword123',
      });
    });

    it('should handle sync error when updating public.users table', async () => {
      const req = {
        body: {
          name: 'Jane Doe',
        },
        user: {
          id: 'user-123',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'jane@example.com',
        user_metadata: { name: 'Jane Doe' },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
        json: jest.fn(),
      };

      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockRejectedValue(new Error('Sync failed')),
        }),
      });

      await updateProfile(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Perfil atualizado com sucesso.',
        })
      );
    });

    it('should ignore empty password string', async () => {
      const req = {
        body: {
          name: 'Jane Doe',
          password: '   ',
        },
        user: {
          id: 'user-123',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'jane@example.com',
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
        json: jest.fn(),
      };

      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      await updateProfile(req, res);

      expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith('user-123', {
        user_metadata: { name: 'Jane Doe' },
      });
    });

    it('should handle update profile error', async () => {
      const req = {
        body: {
          name: 'Jane Doe',
          password: 'newPassword123',
        },
        user: {
          id: 'user-123',
        },
      };

      const res = {
        status: jest.fn().mockReturnValue({
          json: jest.fn(),
        }),
      };

      const error = new Error('Update failed');
      supabase.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error,
      });

      await updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
