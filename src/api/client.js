import axios from 'axios';

const client = axios.create({
  // baseURL: 'http://127.0.0.1:8000/api',
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://pos-api.lmuc-innovations.com/api',
  timeout: 60000
});
// Attach auth token from localStorage on each request
client.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('authToken');
    const expirationTime = localStorage.getItem('authTokenExpiration');
    if (expirationTime && new Date().getTime() > expirationTime) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      localStorage.removeItem('authTokenExpiration');
      window.location.href = '/auth';
      alert('Your session has expired. Please log in again.');
      return Promise.reject(new Error('Session expired'));
    }
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      localStorage.removeItem('authTokenExpiration');
      window.location.href = '/auth';
      alert('Your session is invalid. Please log in again.');
    }
    const message = error.response?.data?.message || error.message;
    return Promise.reject(new Error(message));
  }
);

export default client;
