import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for handling auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // We let the React components and Redux thunks handle the 401 errors.
    // ProtectedRoute handles redirecting to /login automatically.
    return Promise.reject(error);
  }
);

export default api;
