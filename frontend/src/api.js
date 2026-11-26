import axios from 'axios';

// Helper URL API Dinamis NetGuard Hub
// Jika web dibuka langsung dari server Go (:8080), gunakan endpoint relatif (/api/v1) sehingga bebas CORS & akurat di LAN.
// Jika dibuka lewat Vite dev server (:5173), arahkan otomatis ke hostname yang sama di port :8080.
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
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
