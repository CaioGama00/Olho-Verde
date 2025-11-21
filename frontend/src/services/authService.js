import api from './api';

const register = async (name, email, password) => {
  const response = await api.post('/auth/register', {
    name,
    email,
    password,
  });
  return response.data;
};

const login = async (email, password) => {
  const response = await api.post('/auth/login', {
    email,
    password,
  });
  const payload = response.data;
  if (payload?.accessToken || payload?.session?.access_token) {
    localStorage.setItem('user', JSON.stringify(payload));
  }
  return payload;
};

const logout = () => {
  localStorage.removeItem('user');
};

const getCurrentUser = () => {
  const stored = localStorage.getItem('user');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (e) {
    localStorage.removeItem('user');
    return null;
  }
};

const requestPasswordReset = async (email) => {
  const response = await api.post('/auth/password-reset/request', { email });
  return response.data;
};

const confirmPasswordReset = async (accessToken, newPassword) => {
  const response = await api.post('/auth/password-reset/confirm', { accessToken, newPassword });
  return response.data;
};

const updateProfile = async (name, password) => {
  const response = await api.put('/auth/profile', { name, password });

  // Update local storage regardless of response structure if successful
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.user) {
    const updatedUser = {
      ...currentUser,
      user: {
        ...currentUser.user,
        user_metadata: {
          ...(currentUser.user.user_metadata || {}),
          name,
        },
        raw_user_meta_data: {
          ...(currentUser.user.raw_user_meta_data || {}),
          name,
        },
      }
    };

    // If the API returned a user object, merge it in
    if (response.data && response.data.user) {
      updatedUser.user = {
        ...updatedUser.user,
        ...response.data.user,
        user_metadata: {
          ...updatedUser.user.user_metadata,
          ...(response.data.user.user_metadata || {}),
          name, // Ensure name is preserved
        }
      };
    }

    localStorage.setItem('user', JSON.stringify(updatedUser));

    // Return the updated user so the caller can use it
    return { ...response.data, user: updatedUser.user };
  }

  return response.data;
};

export default {
  register,
  login,
  logout,
  getCurrentUser,
  requestPasswordReset,
  confirmPasswordReset,
  updateProfile,
};
