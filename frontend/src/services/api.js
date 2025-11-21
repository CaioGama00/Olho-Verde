import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://olho-verde.onrender.com/api'
    : 'http://localhost:3001/api');

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('user'));
  const token =
    user?.accessToken ||
    user?.access_token ||
    user?.session?.access_token ||
    null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;

    if (status === 401 && !originalRequest._retry) {
      const stored = localStorage.getItem('user');
      if (!stored) {
        return Promise.reject(error);
      }

      let parsed;
      try {
        parsed = JSON.parse(stored);
      } catch {
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }

      const refreshToken =
        parsed?.refreshToken ||
        parsed?.refresh_token ||
        parsed?.session?.refresh_token ||
        null;

      if (!refreshToken) {
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }

      try {
        if (!refreshPromise) {
          refreshPromise = axios.post(
            `${api.defaults.baseURL.replace(/\/$/, '')}/auth/refresh`,
            { refreshToken }
          );
        }

        const refreshResponse = await refreshPromise;
        refreshPromise = null;

        const data = refreshResponse?.data;
        if (!data?.accessToken) {
          localStorage.removeItem('user');
          window.dispatchEvent(new Event('auth:logout'));
          return Promise.reject(error);
        }

        const updated = {
          ...parsed,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user || parsed.user,
          session: data.session || parsed.session,
          isAdmin: data.isAdmin ?? parsed.isAdmin,
        };
        localStorage.setItem('user', JSON.stringify(updated));

        originalRequest._retry = true;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        refreshPromise = null;
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
