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

export default api;
