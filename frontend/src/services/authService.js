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
  if (response.data.user) {
    // Update local storage if user data is returned
    const currentUser = getCurrentUser();
    if (currentUser) {
      currentUser.user = response.data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
    }
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
