import axios from 'axios';

/** API root, e.g. https://your-api.onrender.com/api or /api in local dev */
const rawApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
export const apiBaseUrl = rawApiUrl ? `${rawApiUrl}/api` : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary — default application/json breaks file uploads.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthRoute =
      original?.url?.includes('/auth/request-otp')
      || original?.url?.includes('/auth/verify-otp')
      || original?.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${apiBaseUrl}/auth/refresh`, { refresh_token: refreshToken });
          if (data.success) {
            localStorage.setItem('access_token', data.data.access_token);
            original.headers.Authorization = `Bearer ${data.data.access_token}`;
            return api(original);
          }
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
