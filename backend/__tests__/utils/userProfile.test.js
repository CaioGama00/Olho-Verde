jest.mock('../../db');

const supabase = require('../../db');
const { extractUserProfile, fetchUserProfilesByIds } = require('../../utils/userProfile');

describe('UserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractUserProfile', () => {
    it('should return null values when user is null', () => {
      const result = extractUserProfile(null);

      expect(result).toEqual({ name: null, email: null });
    });

    it('should return null values when user is undefined', () => {
      const result = extractUserProfile(undefined);

      expect(result).toEqual({ name: null, email: null });
    });

    it('should extract name and email from user object properties', () => {
      const user = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should extract name and email from raw_user_meta_data', () => {
      const user = {
        raw_user_meta_data: {
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({
        name: 'Jane Smith',
        email: 'jane@example.com',
      });
    });

    it('should extract name and email from user_metadata', () => {
      const user = {
        user_metadata: {
          name: 'Bob Wilson',
          email: 'bob@example.com',
        },
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({
        name: 'Bob Wilson',
        email: 'bob@example.com',
      });
    });

    it('should prioritize direct user properties over metadata', () => {
      const user = {
        name: 'Direct Name',
        email: 'direct@example.com',
        raw_user_meta_data: {
          name: 'Meta Name',
          email: 'meta@example.com',
        },
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({
        name: 'Direct Name',
        email: 'direct@example.com',
      });
    });

    it('should prioritize raw_user_meta_data over user_metadata', () => {
      const user = {
        raw_user_meta_data: {
          name: 'Raw Name',
          email: 'raw@example.com',
        },
        user_metadata: {
          name: 'User Meta Name',
          email: 'usermeta@example.com',
        },
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({
        name: 'Raw Name',
        email: 'raw@example.com',
      });
    });

    it('should return null for missing name and email', () => {
      const user = {
        id: 'user-123',
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({ name: null, email: null });
    });

    it('should handle partial data extraction', () => {
      const user = {
        name: 'Alice Johnson',
        raw_user_meta_data: {
          email: 'alice@example.com',
        },
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({
        name: 'Alice Johnson',
        email: 'alice@example.com',
      });
    });

    it('should handle empty metadata objects', () => {
      const user = {
        raw_user_meta_data: {},
        user_metadata: {},
      };

      const result = extractUserProfile(user);

      expect(result).toEqual({ name: null, email: null });
    });
  });

  describe('fetchUserProfilesByIds', () => {
    it('should return empty map when userIds array is empty', async () => {
      const result = await fetchUserProfilesByIds([]);

      expect(result).toEqual(new Map());
      expect(supabase.auth.admin.getUserById).not.toHaveBeenCalled();
    });

    it('should return empty map when userIds is undefined', async () => {
      const result = await fetchUserProfilesByIds();

      expect(result).toEqual(new Map());
      expect(supabase.auth.admin.getUserById).not.toHaveBeenCalled();
    });

    it('should deduplicate user IDs before fetching', async () => {
      supabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'user-1', name: 'John' } },
        error: null,
      });

      await fetchUserProfilesByIds(['user-1', 'user-1', 'user-1']);

      expect(supabase.auth.admin.getUserById).toHaveBeenCalledTimes(1);
      expect(supabase.auth.admin.getUserById).toHaveBeenCalledWith('user-1');
    });

    it('should fetch profiles for multiple unique user IDs', async () => {
      supabase.auth.admin.getUserById
        .mockResolvedValueOnce({
          data: { user: { id: 'user-1', name: 'Alice' } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { user: { id: 'user-2', name: 'Bob' } },
          error: null,
        });

      const result = await fetchUserProfilesByIds(['user-1', 'user-2']);

      expect(result.size).toBe(2);
      expect(result.get('user-1')).toEqual({ id: 'user-1', name: 'Alice' });
      expect(result.get('user-2')).toEqual({ id: 'user-2', name: 'Bob' });
    });

    it('should filter out falsy values from userIds', async () => {
      supabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'user-1', name: 'Charlie' } },
        error: null,
      });

      await fetchUserProfilesByIds(['user-1', null, undefined, '', 'user-1']);

      expect(supabase.auth.admin.getUserById).toHaveBeenCalledTimes(1);
      expect(supabase.auth.admin.getUserById).toHaveBeenCalledWith('user-1');
    });

    it('should return null for user when API returns error', async () => {
      supabase.auth.admin.getUserById.mockResolvedValue({
        data: null,
        error: new Error('User not found'),
      });

      const result = await fetchUserProfilesByIds(['user-999']);

      expect(result.get('user-999')).toBeNull();
    });

    it('should return null for user when API throws exception', async () => {
      supabase.auth.admin.getUserById.mockRejectedValue(
        new Error('API connection failed')
      );

      const result = await fetchUserProfilesByIds(['user-error']);

      expect(result.get('user-error')).toBeNull();
    });

    it('should handle mixed success and failure results', async () => {
      supabase.auth.admin.getUserById
        .mockResolvedValueOnce({
          data: { user: { id: 'user-1', name: 'David' } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: new Error('Not found'),
        })
        .mockResolvedValueOnce({
          data: { user: { id: 'user-3', name: 'Eve' } },
          error: null,
        });

      const result = await fetchUserProfilesByIds(['user-1', 'user-2', 'user-3']);

      expect(result.get('user-1')).toEqual({ id: 'user-1', name: 'David' });
      expect(result.get('user-2')).toBeNull();
      expect(result.get('user-3')).toEqual({ id: 'user-3', name: 'Eve' });
    });

    it('should handle user object without user property in data', async () => {
      supabase.auth.admin.getUserById.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await fetchUserProfilesByIds(['user-empty']);

      expect(result.get('user-empty')).toBeNull();
    });

    it('should log error message when fetch fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Database connection error');

      supabase.auth.admin.getUserById.mockRejectedValue(error);

      await fetchUserProfilesByIds(['user-fail']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falha ao buscar perfil do usuário user-fail'),
        expect.stringContaining('Database connection error')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return map with correct structure', async () => {
      supabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'user-1', name: 'Frank', email: 'frank@example.com' } },
        error: null,
      });

      const result = await fetchUserProfilesByIds(['user-1']);

      expect(result instanceof Map).toBe(true);
      expect(result.has('user-1')).toBe(true);
      expect(result.get('user-1')).toEqual({
        id: 'user-1',
        name: 'Frank',
        email: 'frank@example.com',
      });
    });

    it('should handle large array of user IDs', async () => {
      supabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'user-1', name: 'User' } },
        error: null,
      });

      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);
      const result = await fetchUserProfilesByIds(userIds);

      expect(result.size).toBe(100);
      expect(supabase.auth.admin.getUserById).toHaveBeenCalledTimes(100);
    });
  });
});
