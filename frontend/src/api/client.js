import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('calsol_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and redirect to login
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('calsol_token');
      localStorage.removeItem('calsol_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const googleLogin = (id_token) =>
  client.post('/auth/google', { id_token }).then((r) => r.data);

export const getMe = () => client.get('/auth/me').then((r) => r.data);

export const listUsers = () => client.get('/auth/users').then((r) => r.data);

export const updateUser = (userId, data) =>
  client.put(`/auth/users/${userId}`, data).then((r) => r.data);

// ─── Cars ─────────────────────────────────────────────────────────────────────
export const listCars = () => client.get('/cars').then((r) => r.data);

export const createCar = (data) => client.post('/cars', data).then((r) => r.data);

export const updateCar = (carId, data) =>
  client.put(`/cars/${carId}`, data).then((r) => r.data);

export const deleteCar = (carId) =>
  client.delete(`/cars/${carId}`).then((r) => r.data);

// ─── Parts ────────────────────────────────────────────────────────────────────
export const listParts = (carId, params = {}) =>
  client.get(`/cars/${carId}/parts`, { params }).then((r) => r.data);

export const getPart = (carId, partId) =>
  client.get(`/cars/${carId}/parts/${partId}`).then((r) => r.data);

export const createPart = (carId, data) =>
  client.post(`/cars/${carId}/parts`, data).then((r) => r.data);

export const updatePart = (carId, partId, data) =>
  client.put(`/cars/${carId}/parts/${partId}`, data).then((r) => r.data);

export const replacePart = (carId, partId, data) =>
  client.post(`/cars/${carId}/parts/${partId}/replace`, data).then((r) => r.data);

export const deletePart = (carId, partId) =>
  client.delete(`/cars/${carId}/parts/${partId}`).then((r) => r.data);

export const getPartHistory = (carId, params = {}) =>
  client.get(`/cars/${carId}/history`, { params }).then((r) => r.data);

// ─── Part Fields ──────────────────────────────────────────────────────────────
export const listPartFields = () =>
  client.get('/part-fields').then((r) => r.data);

export const createPartField = (data) =>
  client.post('/part-fields', data).then((r) => r.data);

// ─── Miles ────────────────────────────────────────────────────────────────────
export const logMiles = (carId, data) =>
  client.post(`/cars/${carId}/miles`, data).then((r) => r.data);

export const getMilesLog = (carId, params = {}) =>
  client.get(`/cars/${carId}/miles`, { params }).then((r) => r.data);

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportHighMiles = (carId, params = {}) =>
  client.get(`/cars/${carId}/reports/high-miles`, { params }).then((r) => r.data);

export const reportMBF = (carId) =>
  client.get(`/cars/${carId}/reports/mbf`).then((r) => r.data);

export const reportLikelyToFail = (carId) =>
  client.get(`/cars/${carId}/reports/likely-to-fail`).then((r) => r.data);

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadSpreadsheet = (carId, filename, base64Content) =>
  client
    .post(`/cars/${carId}/upload`, { filename, content: base64Content })
    .then((r) => r.data);
