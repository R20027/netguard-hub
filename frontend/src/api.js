import axios from 'axios';

export const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

// Helper URL API Dinamis NetGuard Hub
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    if (hostname.endsWith('github.io')) {
      const custom = localStorage.getItem('guardhub_backend_url');
      if (custom) return `${custom.replace(/\/+$/, '')}/api/v1`;
      return '/api/v1';
    }
    if (port === '8080' || port === '' || port === '80' || port === '443') {
      return '/api/v1';
    }
    return `${protocol}//${hostname}:8080/api/v1`;
  }
  return 'http://localhost:8080/api/v1';
};

export const API = getApiBaseUrl();

// Pasang token autentikasi jika tersedia di localStorage
if (typeof window !== 'undefined') {
  const savedToken = localStorage.getItem('guardhub_token');
  if (savedToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
  }
}

export default API;
